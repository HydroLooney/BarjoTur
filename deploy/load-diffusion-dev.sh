#!/usr/bin/env bash
# load-diffusion-dev.sh (M402 §1) — monte une BASE LOCALE de dev chargée du dump de diffusion v3 (A134), pour valider la
# carto RÉELLE (Martin + /api/carto/*) SANS toucher la prod DB2. Local, réversible (DROP DATABASE), zéro écriture prod.
#
# Fait : crée norvege_dev sur le PostGIS local, charge diffusion-v3-20260816.sql (5 v_web_* autoportantes), renomme le
# schéma diffusion_dump -> diffusion (schéma lu par les RPC carto 015 + tiles/config.dev.toml), applique 015 (RPC GeoJSON
# api.carto_*_geojson, génériques : to_jsonb(vue)-'geom'), et VÉRIFIE (comptes + FeatureCollection). Idempotent (recharge).
#
# Usage : deploy/load-diffusion-dev.sh   (défauts : localhost:5433, base norvege_dev)
set -euo pipefail

PGHOST="${BJT_DEV_PGHOST:-localhost}"
PGPORT="${BJT_DEV_PGPORT:-5433}"
DB="${BJT_DEV_DB:-norvege_dev}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="$ICI/db/sync/diffusion-v3-20260816.sql"
M015="$ICI/db/migrations/015_carto_geojson_rpc.sql"
psqlp() { psql -h "$PGHOST" -p "$PGPORT" "$@"; }

[ -f "$DUMP" ] || { echo "Dump introuvable : $DUMP" >&2; exit 2; }

echo "== 1. (re)création de la base de dev $DB (locale, jetable) =="
psqlp -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psqlp -d "$DB" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis"

echo "== 2. chargement du dump de diffusion (strip \\restrict : skew de version pg) =="
sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' "$DUMP" \
  | psqlp -d "$DB" -v ON_ERROR_STOP=1 -q

echo "== 3. diffusion_dump -> diffusion (schéma servi par les RPC carto + Martin) =="
psqlp -d "$DB" -v ON_ERROR_STOP=1 -c "ALTER SCHEMA diffusion_dump RENAME TO diffusion"

echo "== 3b. typmod des colonnes geom (le pg_dump l'a perdu → catalogue srid 0) : Martin-ready (type + 4326) =="
psqlp -d "$DB" -v ON_ERROR_STOP=1 \
  -c "ALTER TABLE diffusion.v_web_poi              ALTER COLUMN geom TYPE geometry(Point,4326)" \
  -c "ALTER TABLE diffusion.v_web_poi_services_van ALTER COLUMN geom TYPE geometry(Point,4326)" \
  -c "ALTER TABLE diffusion.v_web_decoupage        ALTER COLUMN geom TYPE geometry(MultiPolygon,4326)" \
  -c "ALTER TABLE diffusion.v_web_routes_sceniques ALTER COLUMN geom TYPE geometry(LineString,4326)" \
  -c "ALTER TABLE diffusion.v_web_sentiers         ALTER COLUMN geom TYPE geometry(LineString,4326)"

echo "== 4. schéma api + rôle web_anon + application de 015 (RPC GeoJSON) =="
psqlp -d "$DB" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA IF NOT EXISTS api" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='web_anon') THEN CREATE ROLE web_anon NOLOGIN; END IF; END \$\$"
psqlp -d "$DB" -v ON_ERROR_STOP=1 -f "$M015"

echo "== 5. VÉRIFICATION (R1 : comptes réels + FeatureCollection non vide) =="
psqlp -d "$DB" -tA -v ON_ERROR_STOP=1 <<'SQL'
SELECT '  v_web_poi='            || count(*) FROM diffusion.v_web_poi;
SELECT '  v_web_decoupage='      || count(*) FROM diffusion.v_web_decoupage;
SELECT '  v_web_services_van='   || count(*) FROM diffusion.v_web_poi_services_van;
SELECT '  v_web_routes='         || count(*) FROM diffusion.v_web_routes_sceniques;
SELECT '  v_web_sentiers='       || count(*) FROM diffusion.v_web_sentiers;
SELECT '  carto_poi_geojson.type=' || (api.carto_poi_geojson()->>'type');
SELECT '  carto_poi_geojson.n_features=' || jsonb_array_length(api.carto_poi_geojson()->'features');
SQL

echo "== 6. (option) FICHE POI : poi.poi + api.poi_detail (018) pour GET /api/poi/:cle en dev — best-effort =="
# La fiche (M405) a besoin de poi.poi (détail) : on le tire de DB2 (lecture seule) dans la base de dev + on applique 018.
# Best-effort : si DB2 (SSH bomp4rd) est injoignable, on saute (la carto marche sans). Désactiver : BJT_DEV_WITH_POI=0.
if [ "${BJT_DEV_WITH_POI:-1}" = "1" ]; then
  if ssh -o BatchMode=yes -o ConnectTimeout=8 "${BJT_DB2_SSH:-bomp4rd}" true 2>/dev/null; then
    psqlp -d "$DB" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS poi" >/dev/null
    ssh -o BatchMode=yes "${BJT_DB2_SSH:-bomp4rd}" "docker exec ${BJT_DB2_CONTENEUR:-norvege-db} pg_dump -U norvege -d norvege_v2 -t poi.poi --no-owner --no-privileges" 2>/dev/null \
      | sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' | psqlp -d "$DB" -v ON_ERROR_STOP=1 -q
    psqlp -d "$DB" -v ON_ERROR_STOP=1 -f "$ICI/db/migrations/018_poi_detail_fiche.sql" >/dev/null
    psqlp -d "$DB" -tA -c "SELECT '  poi.poi='||count(*)||' + api.poi_detail OK' FROM poi.poi"
  else
    echo "  (DB2 injoignable → fiche POI sautée ; la carto est prête. Relancer avec accès DB2 pour /api/poi/:cle réel.)"
  fi
fi

echo "== OK : base de dev $DB prête. DSN dev = postgres://$PGHOST:$PGPORT/$DB =="
echo "   Martin : deploy/martin-dev-local.sh (tiles/config.dev.yaml) · BFF dev :"
echo "   DATABASE_URL=postgres://$PGHOST:$PGPORT/$DB PORT=8099 PGSSLMODE=disable PHOTOS_MANIFEST_PATH=\$PWD/data/echantillon-web/photos-manifest.json npm run dev -w server"

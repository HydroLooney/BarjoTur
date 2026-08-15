#!/usr/bin/env bash
# build-dev-db.sh (M424) — monte une base de dev COMPLÈTE `norvege_dev` (locale, jetable, R+W) pour que C valide TOUS les
# endpoints en dev SANS toucher la prod : app (membre/decision/budget/poi/fige/activite/… + RPC api.*) + diffusion (A134) +
# migrations v3. On EXCLUT le schéma mcda2 (1.4 Go de routage) + pavage : AUCUNE RPC servie par le BFF n'y touche (vérifié —
# whoami/set_vote/budget/reglages/esprit/catalogue sont mcda2- et pgrouting-free ; le routage = sidecar). Donc pas besoin de
# pgrouting (versions incompatibles local 4.0 / DB2 3.8) : on strippe CREATE EXTENSION, on pose nous-mêmes postgis/pgcrypto/
# btree_gist (dispo en local). Réversible (DROP DATABASE). R2 : PIN hachés, jamais affichés.
set -euo pipefail

PGHOST="${BJT_DEV_PGHOST:-localhost}"; PGPORT="${BJT_DEV_PGPORT:-5433}"; DB="${BJT_DEV_DB:-norvege_dev}"
SSH="${BJT_DB2_SSH:-bomp4rd}"; CONT="${BJT_DB2_CONTENEUR:-norvege-db}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"
psqlp() { psql -h "$PGHOST" -p "$PGPORT" "$@"; }

echo "== 1. (re)création $DB + extensions (postgis/pgcrypto/btree_gist ; PAS pgrouting) =="
psqlp -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psqlp -d "$DB" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS postgis" \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto" \
  -c "CREATE EXTENSION IF NOT EXISTS btree_gist" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='web_anon') THEN CREATE ROLE web_anon NOLOGIN; END IF; END \$\$"

echo "== 2. restore app (norvege_v2 SANS mcda2/pavage ; strip \\restrict + CREATE EXTENSION ; tolérant) =="
# Tolérant (pas de ON_ERROR_STOP) : les objets NON servis par le BFF qui référencent mcda2 (routage) échouent — sans effet
# sur les RPC de C (mcda2-free). On strippe les CREATE/COMMENT EXTENSION (extensions déjà posées, versions maîtrisées).
# --exclude-schema=diffusion : le schéma diffusion FONDATEUR de DB2 (v_web_poi ancien) entrerait en collision avec le
# diffusion v3 d'A134 (chargé à l'étape 3). A134 est la vraie diffusion v3 → on écarte le fondateur.
ssh -o BatchMode=yes "$SSH" "docker exec $CONT pg_dump -U norvege -d norvege_v2 --exclude-schema=mcda2 --exclude-schema=pavage --exclude-schema=diffusion --no-owner --no-privileges" 2>/dev/null \
  | sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' -e '/^CREATE EXTENSION /d' -e '/^COMMENT ON EXTENSION /d' \
  | psqlp -d "$DB" -q 2>/tmp/bjt-devdb-restore.log || true
echo "  restore fini (erreurs tolérées d'objets mcda2-dépendants → /tmp/bjt-devdb-restore.log, $(grep -c '^ERROR' /tmp/bjt-devdb-restore.log 2>/dev/null || echo 0) erreurs)"

echo "== 3. diffusion v3 FINALE (20260817, 7 tables : +bases_ideales +poi_photos) + typmod geom (Martin-ready) =="
sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' "$ICI/db/sync/diffusion-v3-final-20260817.sql" | psqlp -d "$DB" -v ON_ERROR_STOP=1 -q
psqlp -d "$DB" -v ON_ERROR_STOP=1 -c "ALTER SCHEMA diffusion_dump RENAME TO diffusion" >/dev/null 2>&1 || true
psqlp -d "$DB" -v ON_ERROR_STOP=1 \
  -c "ALTER TABLE diffusion.v_web_poi ALTER COLUMN geom TYPE geometry(Point,4326)" \
  -c "ALTER TABLE diffusion.v_web_poi_services_van ALTER COLUMN geom TYPE geometry(Point,4326)" \
  -c "ALTER TABLE diffusion.v_web_decoupage ALTER COLUMN geom TYPE geometry(MultiPolygon,4326)" \
  -c "ALTER TABLE diffusion.v_web_routes_sceniques ALTER COLUMN geom TYPE geometry(LineString,4326)" \
  -c "ALTER TABLE diffusion.v_web_sentiers ALTER COLUMN geom TYPE geometry(LineString,4326)" \
  -c "ALTER TABLE diffusion.v_web_bases_ideales ALTER COLUMN geom TYPE geometry(Point,4326)"

echo "== 4. migrations v3 (app-pertinentes) : 013 014 015 016 018 019 (012/017 gatés vues bases/circuits → sautés) =="
for m in 013_conducteur_et_contraintes_medicales 014_reglages_rpc 015_carto_geojson_rpc 016_vote_atomique_paniers_cascade 018_poi_detail_fiche 019_whoami_conducteur; do
  psqlp -d "$DB" -v ON_ERROR_STOP=1 -f "$ICI/db/migrations/$m.sql" >/dev/null 2>>/tmp/bjt-devdb-mig.log && echo "  $m OK" || echo "  $m ÉCHEC (voir /tmp/bjt-devdb-mig.log)"
done

echo "== 4b. dev-seed : comptes synthétiques (DEV-ORG/KID/MAM, PIN 0000) + recos_voyageur stand-in (R2, dev only) =="
psqlp -d "$DB" -v ON_ERROR_STOP=1 -f "$ICI/deploy/dev-seed.sql" >/dev/null && echo "  dev-seed OK"

echo "== 5. VÉRIFICATION (comptes app + RPC clés) =="
psqlp -d "$DB" -tA -v ON_ERROR_STOP=1 <<'SQL'
SELECT '  membres='||count(*) FROM membre.membre;
SELECT '  votes_lieu='||count(*) FROM decision.vote_lieu;
SELECT '  poi='||count(*) FROM poi.poi;
SELECT '  whoami_a_conducteur='||(pg_get_functiondef('api.whoami(text)'::regprocedure) ILIKE '%conducteur%')::text;
SELECT '  reglages_conduite_n='||jsonb_array_length(api.reglages_lire('conduite'));
SELECT '  carto_poi_n='||jsonb_array_length(api.carto_poi_geojson()->'features');
SQL
echo "== OK : $DB complète. BFF dev :"
echo "   DATABASE_URL=postgres://$PGHOST:$PGPORT/$DB PORT=8099 PGSSLMODE=disable PHOTOS_MANIFEST_PATH=$ICI/data/echantillon-web/photos-manifest.json npm run dev -w server"

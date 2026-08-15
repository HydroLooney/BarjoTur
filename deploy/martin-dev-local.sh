#!/usr/bin/env bash
# martin-dev-local.sh (M402 §1) — monte la carto de DEV en une commande, base LOCALE, ZÉRO prod :
#   1) charge le dump de diffusion A134 dans norvege_dev (load-diffusion-dev.sh) ;
#   2) lance Martin (tuiles v_web_*) sur tiles/config.dev.toml ;
#   3) rappelle les URLs à donner à C (tuiles + endpoint POI GeoJSON servi par le BFF de dev).
# Réversible : le BFF de dev se lance à part (voir plus bas) ; DROP DATABASE norvege_dev pour tout défaire.
set -euo pipefail

ICI="$(cd "$(dirname "$0")/.." && pwd)"
DEV_DSN="${MARTIN_DEV_DB_URL:-postgres://localhost:5433/norvege_dev}"

echo "== 1. base de dev (idempotent) =="
"$ICI/deploy/load-diffusion-dev.sh"

echo "== 2. Martin =="
if ! command -v martin >/dev/null 2>&1; then
  cat >&2 <<EOF
  ⚠ Martin n'est pas installé sur ce poste. Installe-le puis relance :
      brew install martin          # bottle homebrew-core 1.13 — ou : cargo install martin
      # binaire : https://github.com/maplibre/martin/releases
  La base de dev et l'endpoint POI (BFF) sont, eux, DÉJÀ opérationnels (étape 3).
EOF
  exit 0
fi
echo "  martin --config tiles/config.yaml  (écoute 0.0.0.0:8003)"
MARTIN_DB_URL="$DEV_DSN" PGSSLMODE=disable exec martin --config "$ICI/tiles/config.yaml"

# ------------------------------------------------------------------------------------------------
# URLs pour C (validation carto sur donnée réelle, sans prod) :
#   Tuiles Martin (une fois lancé)   : http://localhost:8003/catalog                (liste des sources)
#                                      http://localhost:8003/v_web_poi/{z}/{x}/{y}   (POI)
#                                      http://localhost:8003/v_web_sentiers/{z}/{x}/{y}, v_web_decoupage, v_web_routes_sceniques, v_web_poi_services_van
#   Endpoint POI GeoJSON (BFF dev)   : http://localhost:8099/api/carto/poi          (+ /decoupage-geo /services-van /routes-sceniques /sentiers-geo)
#     BFF de dev : DATABASE_URL=postgres://localhost:5433/norvege_dev PORT=8099 PGSSLMODE=disable npm run dev -w server
# ------------------------------------------------------------------------------------------------

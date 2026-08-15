#!/usr/bin/env bash
# smoke-e2e.sh (M280) — smoke end-to-end de la stack v3 APRÈS déploiement (bff + sidecar + martin + client).
# LECTURE seule : ne fait que des GET de santé/lecture. Sort non-zéro si un check échoue (utilisable en gate de bascule).
# Aucune écriture, aucun secret manipulé (R2). Les URLs sont paramétrables par env (défauts = noms de service compose).
set -uo pipefail

BFF="${BFF_URL:-http://bff:8080}"
SIDECAR="${SIDECAR_URL:-http://sidecar:8001}"
MARTIN="${MARTIN_URL:-http://martin:8003}"   # Martin écoute sur 8003 (tiles/config.toml [srv]) ; proxy amont /tiles → martin:8003
CLIENT="${CLIENT_URL:-http://client}"

fail=0
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" 2>/dev/null || echo 000; }
check() { # $1 label, $2 url, $3 code attendu (défaut 200)
  local att="${3:-200}"; local got; got="$(code "$2")"
  if [ "$got" = "$att" ]; then echo "✅ $1 ($got)"; else echo "❌ $1 : attendu $att, obtenu $got — $2"; fail=1; fi
}

echo "== Santé des 4 services =="
check "bff /api/sante"       "$BFF/api/sante"
check "sidecar /health"      "$SIDECAR/health"
check "martin /health"       "$MARTIN/health"
check "client /"             "$CLIENT/"

echo "== Contenu vérifiable (bff, DB2) =="
# db2:ok dans la santé (chaîne exacte, sans secret)
if curl -s --max-time 10 "$BFF/api/sante" 2>/dev/null | grep -q '"db2":"ok"'; then echo "✅ bff↔DB2 (db2:ok)"; else echo "❌ bff↔DB2 : db2 non ok"; fail=1; fi
check "bff /api/fige/141"        "$BFF/api/fige/141"
check "bff /api/carto/calques"             "$BFF/api/carto/calques"     # 200 même vide tant que 012/vues absentes (dégradation)
check "bff /api/carto/decoupage"           "$BFF/api/carto/decoupage"
check "bff /api/carto/sentiers/difficultes" "$BFF/api/carto/sentiers/difficultes"
check "bff /api/carto/circuits"            "$BFF/api/carto/circuits"
check "bff /api/carto/bases"               "$BFF/api/carto/bases"

echo "== Tuiles Martin (une couche connue) =="
check "martin catalogue"     "$MARTIN/catalog"

echo "----"
if [ "$fail" = 0 ]; then echo "== SMOKE E2E : PASS =="; else echo "== SMOKE E2E : FAIL =="; fi
exit "$fail"

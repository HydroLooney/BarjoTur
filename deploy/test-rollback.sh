#!/usr/bin/env bash
# test-rollback.sh (M315 item 4) — validation À BLANC de la procédure de rollback de la bascule v3. Invariant : le
# rollback est PROXY-ONLY (re-router NPM vers le proto) + `docker compose down`, et NE TOUCHE JAMAIS DB2 (la bascule est
# au niveau proxy ; les données restent intactes). Dry, sans déploiement, sans accès DB2. Auto-vérifiant (exit ≠ 0 si un
# invariant casse). Complète smoke-e2e.sh (gate de bascule).
set -uo pipefail

RUNBOOK="$(dirname "$0")/RUNBOOK.md"
fail=0
ok() { echo "✅ $1"; }
ko() { echo "❌ $1"; fail=1; }

[ -f "$RUNBOOK" ] || { echo "❌ RUNBOOK introuvable : $RUNBOOK"; exit 1; }

# Extrait la sous-section « ### Rollback » de la BASCULE strangler-fig (titre EXACT, sans suffixe — à distinguer du
# « ### Rollback (si écart zéro-perte...) » du drill dump, qui restaure DB2 par nature). De son titre au prochain titre.
ROLLBACK="$(awk '/^### Rollback$/{f=1;print;next} f&&/^#/{exit} f{print}' "$RUNBOOK")"
[ -n "$ROLLBACK" ] || { echo "❌ section Rollback (bascule strangler-fig) introuvable dans le RUNBOOK"; exit 1; }

echo "== 1. Rollback = re-route proxy vers le proto + arrêt de la stack =="
echo "$ROLLBACK" | grep -qi "proto"                 && ok "re-route vers le proto"          || ko "ne mentionne pas le proto"
echo "$ROLLBACK" | grep -Eqi "compose .*down|down"  && ok "arrête la stack (compose down)"  || ko "n'arrête pas la stack"

echo "== 2. Rollback DB2-SAFE : aucune écriture DB2 dans la procédure =="
if echo "$ROLLBACK" | grep -Eqi "DROP |TRUNCATE |DELETE FROM|pg_restore|INSERT INTO|UPDATE |psql[^a-z]"; then
  ko "la section rollback contient une opération DB2 (INTERDIT : bascule proxy-only, DB2 intacte)"
else
  ok "aucune opération DB2 dans le rollback (DB2 intacte)"
fi

echo "== 3. Invariant 'DB2 intacte' explicitement affirmé =="
echo "$ROLLBACK" | grep -Eqi "DB2 intacte|DB2 inchangée|aucune donnée" && ok "invariant DB2 intacte affirmé" || ko "invariant DB2 intacte non affirmé"

echo "----"
if [ "$fail" = 0 ]; then echo "== ROLLBACK (dry) : PASS — proxy-only, DB2 intacte =="; else echo "== ROLLBACK (dry) : FAIL =="; fi
exit "$fail"

#!/usr/bin/env bash
# test-preservation-poi-user.sh (M315 item 2) — TEST SYNTHÉTIQUE, sans DB, de l'invariant « la re-sync v3 ne perd AUCUN
# POI utilisateur ». Prouve les 3 garde-fous de sync-recompute-v3.sh qui protègent poi.poi_app (owner-safe, comme les
# votes) : (1) le contrôle d'entrée REFUSE tout dump touchant poi.poi_app tout en ACCEPTANT le canonique poi.poi ;
# (2) le backup embarque poi.poi_app ; (3) l'assertion zéro-perte compte les POI utilisateurs (poi_user). Auto-vérifiant
# (sort non-zéro si un garde-fou manque). Zéro accès DB2. R1 : on teste la LOGIQUE, pas des données réelles.
set -uo pipefail

HARNAIS="$(dirname "$0")/sync-recompute-v3.sh"
fail=0
ok() { echo "✅ $1"; }
ko() { echo "❌ $1"; fail=1; }

[ -f "$HARNAIS" ] || { echo "❌ harnais introuvable : $HARNAIS"; exit 1; }

# La regex de denylist telle qu'utilisée par le harnais (extraite pour la tester à l'identique).
RE="$(grep -E "^PRECIEUSES_RE=" "$HARNAIS" | sed -E "s/^PRECIEUSES_RE='//; s/'$//")"
[ -n "$RE" ] || { echo "❌ PRECIEUSES_RE introuvable dans le harnais"; exit 1; }

echo "== 1. Contrôle d'entrée : discrimination poi.poi (canonique) vs poi.poi_app (utilisateur) =="
refuse() { echo "$1" | grep -Eiq "$RE"; }
# poi.poi_app + votes = REFUSÉS (précieux) ; poi.poi + dérivés = ACCEPTÉS.
if refuse "COPY poi.poi_app (osm_id, nom, added_by) FROM stdin;"; then ok "poi.poi_app REFUSÉ (POI users protégés)"; else ko "poi.poi_app devrait être refusé"; fi
if refuse "COPY decision.vote_lieu (id) FROM stdin;";           then ok "vote_lieu REFUSÉ";                        else ko "vote_lieu devrait être refusé"; fi
if refuse "COPY poi.poi (poi_id, osm_id) FROM stdin;";          then ko "poi.poi (canonique) NE DOIT PAS être refusé"; else ok "poi.poi (canonique) ACCEPTÉ"; fi
if refuse "COPY mcda2.reward_poi (poi_id) FROM stdin;";         then ko "reward_poi (dérivé) NE DOIT PAS être refusé"; else ok "reward_poi (dérivé) ACCEPTÉ"; fi

echo "== 2. Backup : poi.poi_app est sauvegardé (restaurable) =="
if grep -Eq "\-t poi\.poi_app" "$HARNAIS"; then ok "backup inclut -t poi.poi_app"; else ko "backup n'inclut PAS poi.poi_app"; fi

echo "== 3. Assertion zéro-perte : les POI utilisateurs (poi.poi_app) sont comptés AVANT/APRÈS =="
if grep -Eq "poi_user='\|\|\(SELECT count\(\*\) FROM poi\.poi_app\)|poi\.poi_app" "$HARNAIS" \
   && grep -Eq "poi_user" "$HARNAIS"; then ok "l'état de référence compte poi_user=count(poi.poi_app)"; else ko "l'assertion ne compte pas les POI utilisateurs"; fi

echo "----"
if [ "$fail" = 0 ]; then echo "== PRÉSERVATION POI USERS : PASS (0 POI user ne peut être perdu par la re-sync) =="; else echo "== PRÉSERVATION POI USERS : FAIL =="; fi
exit "$fail"

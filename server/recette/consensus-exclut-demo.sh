#!/usr/bin/env bash
# Sonde de recette (LECTURE SEULE) : le consensus du budget-temps IGNORE les votes/appétits des liens
# votesComptent=false (portée suggestion → rôle `demo` ; vitrine → `invite`, qui ne peut pas voter). Invariant M188 §1,
# aligné sur shared/src/role.ts (PORTEE_DEFAUT.suggestion.votesComptent=false) et sur decision._vote_base (base
# consensus, qui exclut déjà `demo`). api.budget_temps_poi (008b/009) agrégeait avis+appétit SANS ce filtre → fuite :
# un lien suggestion aurait skewé les durées proposées du groupe. La migration 011 pose decision.role_vote_compte()
# et câble le filtre dans les deux CTE (av, ap).
#
# HONNÊTETÉ (R1) : ZÉRO écriture. On ne touche à AUCUNE table (précieuse ou non). La preuve tient en trois volets
# purement SELECT :
#   1. UNIT  — decision.role_vote_compte(role) : demo/invite → false ; tout le reste (voyageur/owner/mamie/enfant/null) → true.
#   2. CABLE — pg_get_functiondef(api.budget_temps_poi) référence role_vote_compte dans le join avis ET le join appétit.
#   3. LOGIQUE — contre-factuel sur VALUES (pas de vote réel) : avg(facteur_avis) FILTER(role compte) diffère de l'avg brut
#                dès qu'un demo est présent → le filtre change bien l'agrégat.
# L'injection de vote de bout en bout est VOLONTAIREMENT écartée (frontière « pas de test dans les tables précieuses »).
# Accès DB2 = SSH + docker exec (DSN chez GB). Aucun secret manipulé.
#
# Usage : server/recette/consensus-exclut-demo.sh
# RED attendu AVANT 011 (UNIT + CABLE échouent : helper absent / fonction non câblée) ; GREEN APRÈS.

set -euo pipefail

SSH_HOST="${BJT_DB2_SSH:-bomp4rd}"
CONTAINER="${BJT_DB2_CONTENEUR:-norvege-db}"
DBUSER="${BJT_DB2_USER:-norvege}"
DB="${BJT_DB2_NAME:-norvege_v2}"

psql_at() { ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -Atc \"$1\""; }

fail=0
ok()  { echo "✅ $1"; }
ko()  { echo "❌ $1"; fail=1; }

# 1. UNIT : la règle votesComptent (helper pur, aucune donnée).
UNIT="$(psql_at "SELECT to_regprocedure('decision.role_vote_compte(text)') IS NOT NULL")"
if [ "$UNIT" != "t" ]; then
  ko "UNIT : decision.role_vote_compte(text) absent (migration 011 non appliquée)"
else
  # boolean::text rend 'true'/'false' ; on émet 't'/'f' pour comparer à la forme attendue.
  R="$(psql_at "SELECT string_agg(CASE WHEN decision.role_vote_compte(x) THEN 't' ELSE 'f' END, ',' ORDER BY o) FROM (VALUES ('demo',1),('invite',2),('voyageur',3),('owner',4),('mamie',5),('enfant',6),(NULL,7)) v(x,o)")"
  # attendu : demo=f, invite=f, puis 5× t
  if [ "$R" = "f,f,t,t,t,t,t" ]; then ok "UNIT role_vote_compte : demo/invite=false, reste=true ($R)"
  else ko "UNIT role_vote_compte incorrect : $R (attendu f,f,t,t,t,t,t)"; fi
fi

# 2. CABLE : budget_temps_poi utilise le helper dans les DEUX agrégats (avis + appétit).
DEF="$(psql_at "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='budget_temps_poi'" || true)"
N="$(printf '%s' "$DEF" | grep -c 'role_vote_compte' || true)"
if [ "${N:-0}" -ge 2 ]; then ok "CABLE : budget_temps_poi référence role_vote_compte $N fois (avis + appétit)"
else ko "CABLE : budget_temps_poi ne câble pas le filtre ($N occurrence(s), attendu ≥2)"; fi

# 3. LOGIQUE : contre-factuel sur VALUES — le filtre change l'agrégat avis dès qu'un demo pèse.
#    Sans filtre : avg(T=1.30, demoT=1.30) ; avec filtre : avg(T=1.30 seul). On construit un cas où ils DIFFÈRENT.
CF="$(psql_at "
  WITH votes(role, tier) AS (VALUES ('voyageur','B'), ('demo','T'))
  SELECT (round(avg(lib.facteur_avis(tier)), 4))::text || '|' ||
         (round(avg(lib.facteur_avis(tier)) FILTER (WHERE COALESCE(decision.role_vote_compte(role), true)), 4))::text
  FROM votes")"
BRUT="${CF%%|*}"; FILT="${CF##*|}"
# brut = avg(1.00, 1.30)=1.15 ; filtré (demo exclu) = 1.00. Doivent différer.
if [ -n "$CF" ] && [ "$BRUT" != "$FILT" ]; then ok "LOGIQUE : filtre actif — brut=$BRUT vs filtré(demo exclu)=$FILT"
else ko "LOGIQUE : le filtre ne change pas l'agrégat (brut=$BRUT filtré=$FILT) — helper absent ou neutre"; fi

echo "----"
[ "$fail" -eq 0 ] && echo "== PASS ==" || { echo "== FAIL =="; exit 1; }

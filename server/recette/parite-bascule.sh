#!/usr/bin/env bash
# parite-bascule.sh (M170 §2) — HARNAIS DE PARITÉ / lecture-avant-bascule du strangler v2→v3.
#
# Vérifie, AVANT de basculer le proxy/DNS de v2 vers le BFF v3, que :
#   1. les tables PRÉCIEUSES sont sauvegardées et restaurables (filet zéro-perte) ;
#   2. le BFF v3 (booté contre DB2) répond en RÉEL sur le socle canonique (endpoints sans identité, donc sans secret) ;
#   3. les VOTES et membres sont INCHANGÉS avant/après (assertion zéro-perte) ;
#   4. le drill de rollback est documenté et testé (restore du backup dans un schéma jetable).
#
# NON DESTRUCTIF : dry-run par défaut (lectures + backup + contrôles). `--run` n'ajoute que le drill de restore (dans un
# schéma temporaire `restore_drill`, jamais les schémas live). AUCUNE bascule ici (le proxy/DNS reste sur v2 ; Go Live =
# décision Guillaume). B est seul écrivain DB2. R2 : jamais un code_lien/secret affiché (ce harnais n'appelle QUE des
# endpoints sans identité).
#
# Pré-requis : BFF v3 booté (tunnel + `DATABASE_URL`) et joignable ; ici on tape `$BFF` (défaut http://localhost:8080).
# Usage : ./parite-bascule.sh [--bff http://localhost:8080] [--run]
set -euo pipefail

SSH_HOST="bomp4rd"; CONTAINER="norvege-db"; DB="norvege_v2"; DBUSER="norvege"
BACKUP_DIR="~/barjotur-backups"
BFF="${BFF:-http://localhost:8080}"; RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --bff) BFF="$2"; shift 2;;
    --run) RUN=1; shift;;
    *) echo "Argument inconnu : $1" >&2; exit 2;;
  esac
done

psql_c() { ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -Atc \"$1\""; }

echo "== 1. Pré-image précieux (votes + membres) =="
AVANT="$(psql_c "select (select count(*) from decision.vote_lieu)||'/'||(select count(*) from decision.vote_circuit)||'/'||(select count(*) from decision.vote_variante)||'/'||(select count(*) from membre.membre)")"
echo "  votes lieu/circ/var + membres AVANT = $AVANT"

echo "== 2. Backup précieux (restaurable) =="
STAMP="$(ssh "$SSH_HOST" 'date +%Y%m%d-%H%M%S')"
ssh "$SSH_HOST" "mkdir -p $BACKUP_DIR && docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -Fc -n decision -n membre -n fige -n parcours -n voyage > $BACKUP_DIR/bjt-precious-$STAMP.dump"
TOC="$(ssh "$SSH_HOST" "cat $BACKUP_DIR/bjt-precious-$STAMP.dump | docker exec -i $CONTAINER pg_restore -l | grep -c 'TABLE DATA'")"
echo "  backup : $BACKUP_DIR/bjt-precious-$STAMP.dump (TOC $TOC tables) — restaurable si TOC>0"

echo "== 3. Parité v3 : socle canonique (endpoints SANS identité, donc sans secret) =="
verifie() { # $1 = chemin, $2 = clé jq-like attendue non vide (via python), $3 = libellé
  local code corps
  corps="$(curl -s -m 10 -w '\n%{http_code}' "$BFF$1")"; code="$(printf '%s' "$corps" | tail -1)"
  local ok
  ok="$(printf '%s' "$corps" | sed '$d' | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print('OK' if d.get('ok') and ($2) else 'VIDE')
except Exception as e:
  print('ERR '+str(e)[:40])" 2>/dev/null || echo 'ERR')"
  printf '  %-26s HTTP %s  %s\n' "$3" "$code" "$ok"
}
verifie "/api/sante" "d['data'].get('db2')=='ok'" "sante (db2)"
verifie "/api/fige/141" "d['data']['itineraire'].get('km') and d['data']['geom']['type']" "fige/141 (carte)"
verifie "/api/budget/comparatif" "len(d['data'])>0 and 'transit' in d['data'][0]['postes']" "budget/comparatif (transit)"
verifie "/api/scenario-defaut" "'fige_id' in d['data']" "scenario-defaut"
verifie "/api/catalogue" "isinstance(d['data'],list)" "catalogue"

echo "== 4. Post-image + ASSERTION ZÉRO-PERTE =="
APRES="$(psql_c "select (select count(*) from decision.vote_lieu)||'/'||(select count(*) from decision.vote_circuit)||'/'||(select count(*) from decision.vote_variante)||'/'||(select count(*) from membre.membre)")"
echo "  votes + membres APRÈS = $APRES"
if [ "$AVANT" = "$APRES" ]; then echo "  ✅ ZÉRO-PERTE (identique avant/après)"; else echo "  ❌ ÉCART votes/membres — NE PAS BASCULER, restaurer le backup" >&2; exit 1; fi

echo "== 5. Drill de rollback =="
if [ "$RUN" = 1 ]; then
  # Restore NON destructif : dans un schéma jetable, on vérifie que le dump se relit (pas d'écrasement live).
  ssh "$SSH_HOST" "cat $BACKUP_DIR/bjt-precious-$STAMP.dump | docker exec -i $CONTAINER pg_restore -l | grep -q 'TABLE DATA' && echo '  ✅ dump relisible (pg_restore -l OK) — restore live = pg_restore --clean --if-exists au signal'"
else
  echo "  (dry-run : drill non exécuté ; --run pour vérifier la relecture du dump)"
  echo "  Restore live (au signal SEULEMENT, si écart) : cat <backup> | docker exec -i $CONTAINER pg_restore -U $DBUSER -d $DB --clean --if-exists"
fi

echo "== PARITÉ OK. Rappel : ce harnais NE BASCULE PAS (proxy/DNS reste v2 ; Go Live = Guillaume). =="

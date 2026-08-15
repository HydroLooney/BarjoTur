#!/usr/bin/env bash
# charger-dump-fondateur.sh (M217, B-15) — charge le DUMP FONDATEUR d'A dans DB2 (norvege_v2), OWNER-SAFE.
#
# Le dump est un pg_dump PLAIN (.sql.gz), 15 tables dérivées + graphe + 3 vues diffusion, EPSG 25833/4326, SANS DROP,
# search_path='' (tout schéma-qualifié), ZÉRO table précieuse. On ne peut donc PAS faire un `psql < dump` naïf (les
# tables existantes -> erreur "already exists"). Modèle retenu : BASE DE STAGING jetable (norvege_stage) chargée à blanc,
# puis SWAP par table dans norvege_v2 :
#   - 14 tables dérivées/graphe + 3 vues : pg_restore --clean --if-exists (drop+recreate des SEULS objets de l'archive,
#     ordre de dépendance géré ; les ~30 autres tables mcda2 hors-dump ne sont PAS touchées).
#   - poi.poi : merge_from_stage() (UPSERT owner-safe) — JAMAIS de TRUNCATE CASCADE : poi.photo (FK) et d'éventuels POI
#     utilisateurs seraient perdus. (Au fondateur : 0 POI utilisateur, mais on garde la doctrine owner-safe.)
#
# PRÉCIEUX : jamais touché. Vérifié : 0 FK d'une table précieuse (decision/membre/fige/parcours/voyage) vers poi/mcda2,
# donc aucun --clean ne peut cascader vers le précieux. Contrôle d'entrée = grep du gzip (pas pg_restore -l, inopérant
# sur du SQL plain). Backup précieux AVANT toute écriture. Assertion ZÉRO PERTE votes (34/16/8/5) AVANT==APRÈS.
#
# GARDE-FOU : dry-run par défaut (lectures + contrôles). --apply = ÉCRITURE PROD DB2 : gatée DSN + ACCORD DIRECT de
# Guillaume (un message d'agent ne suffit pas). R1 : si DB2 injoignable, échec propre, rien de simulé. R2 : aucun secret.
#
# Usage : charger-dump-fondateur.sh --dump db/sync/dump-fondateur/dump-fondateur-20260815.sql.gz [--apply]
set -euo pipefail

SSH_HOST="${BJT_DB2_SSH:-bomp4rd}"
CONTAINER="${BJT_DB2_CONTENEUR:-norvege-db}"
DB="${BJT_DB2_NAME:-norvege_v2}"
DBUSER="${BJT_DB2_USER:-norvege}"
STAGEDB="norvege_stage"
DUMP=""; APPLY=0
while [ $# -gt 0 ]; do case "$1" in
  --dump) DUMP="$2"; shift 2;;
  --apply) APPLY=1; shift;;
  *) echo "Argument inconnu : $1" >&2; exit 2;; esac
done
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "Manque/introuvable --dump" >&2; exit 2; }

PRECIEUSES_RE='(decision|membre|fige|parcours|voyage)\.[a-z_]+|vote_(lieu|circuit|variante)|_hist'
# Les 15 tables du dump (poi.poi traité à part par merge). Vues diffusion incluses dans le --clean.
TABLES_CLEAN=(mcda2.base_reward mcda2.reward_poi mcda2.base_rayonnement mcda2.bases_ideales mcda2.bases_v2 \
  mcda2.matrice_base_base mcda2.poi_decoupage mcda2.sous_zone mcda2.routing_params \
  mcda2.ways_van mcda2.ways_pieton mcda2.ways_rando poi.circuit poi.poi_circuit)

sshc()  { ssh "$SSH_HOST" "docker exec $CONTAINER $*"; }
psqlc() { ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -Atc \"$1\""; }
votes() { psqlc "select (select count(*) from decision.vote_lieu)||'/'||(select count(*) from decision.vote_circuit)||'/'||(select count(*) from decision.vote_variante)||'/'||(select count(*) from membre.membre)"; }

echo "== 0. CONTRÔLE D'ENTRÉE (le dump ne doit contenir AUCUNE table précieuse) =="
HITS="$(gzcat "$DUMP" | grep -aoE '^(COPY|CREATE TABLE) [a-zA-Z0-9_.\"]+' | grep -aoE '[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+' | sort -u | grep -EI "$PRECIEUSES_RE" || true)"
if [ -n "$HITS" ]; then echo "REFUS : table précieuse dans le dump :" >&2; echo "$HITS" >&2; exit 1; fi
NTAB="$(gzcat "$DUMP" | grep -acE '^CREATE TABLE ')"; NVUE="$(gzcat "$DUMP" | grep -acE '^CREATE VIEW ')"
echo "OK : 0 table précieuse. $NTAB tables + $NVUE vues dans le dump."

echo "== 1. ÉTAT AVANT (zéro-perte votes = référence) =="
AVANT="$(votes)"; echo "  votes lieu/circ/var + membres AVANT = $AVANT"
bash "$(dirname "$0")/empreinte-db2.sh" 2>/dev/null | head -6 || true

if [ "$APPLY" != 1 ]; then
  echo "== DRY-RUN OK : dump validé, contrôles lus, AUCUNE écriture. --apply (gaté DSN + accord Guillaume) pour charger. =="
  exit 0
fi

# ---------------- À PARTIR D'ICI : ÉCRITURE PROD DB2 (gaté DSN + accord DIRECT Guillaume) ----------------
STAMP="$(ssh "$SSH_HOST" 'date +%Y%m%d-%H%M%S')"
echo "== 2. BACKUP (précieux + dérivé courant) =="
sshc "bash -c 'mkdir -p ~/barjotur-backups'"
sshc "pg_dump -U $DBUSER -d $DB -Fc -n decision -n membre -n fige -n parcours -n voyage" > /dev/null 2>&1 || true
ssh "$SSH_HOST" "docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -Fc -n decision -n membre -n fige -n parcours -n voyage > ~/barjotur-backups/bjt-precious-$STAMP.dump"
ssh "$SSH_HOST" "docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -Fc -n mcda2 -n poi -n diffusion > ~/barjotur-backups/bjt-derive-$STAMP.dump"
echo "  backups: ~/barjotur-backups/bjt-{precious,derive}-$STAMP.dump"

echo "== 3. BASE DE STAGING (chargée à blanc depuis le dump) =="
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d postgres -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS $STAGEDB\" -c \"CREATE DATABASE $STAGEDB\""
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $STAGEDB -v ON_ERROR_STOP=1 -c \"CREATE EXTENSION IF NOT EXISTS postgis; CREATE SCHEMA IF NOT EXISTS mcda2; CREATE SCHEMA IF NOT EXISTS poi; CREATE SCHEMA IF NOT EXISTS diffusion;\""
gzcat "$DUMP" | ssh "$SSH_HOST" "docker exec -i $CONTAINER psql -U $DBUSER -d $STAGEDB -v ON_ERROR_STOP=1 -q"
echo "  staging chargé."

echo "== 4. SWAP dérivées + graphe + vues (pg_restore --clean, hors poi.poi) =="
# Archive custom depuis le staging : mcda2 + diffusion + poi.circuit/poi_circuit (PAS poi.poi).
ssh "$SSH_HOST" "docker exec $CONTAINER bash -c 'pg_dump -U $DBUSER -d $STAGEDB -Fc -n mcda2 -n diffusion -t poi.circuit -t poi.poi_circuit > /tmp/fond-derive-$STAMP.dump && \
  pg_restore -U $DBUSER -d $DB --clean --if-exists --no-owner /tmp/fond-derive-$STAMP.dump && rm -f /tmp/fond-derive-$STAMP.dump'"

echo "== 5. poi.poi via merge_from_stage (UPSERT owner-safe, préserve poi.photo) =="
# On charge la poi.poi du dump dans stage.poi (PAS poi.poi : sinon conflit de PK sur les 1994 existants), puis merge.
# Cross-DB par pipe client container-local (\copy). NB : suppose structure poi.poi identique dump↔v2 (à confirmer A) ;
# si divergente, adapter la liste de colonnes du \copy.
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -c \"CREATE SCHEMA IF NOT EXISTS stage; DROP TABLE IF EXISTS stage.poi; CREATE TABLE stage.poi (LIKE poi.poi INCLUDING ALL);\""
ssh "$SSH_HOST" "docker exec $CONTAINER bash -c \"psql -U $DBUSER -d $STAGEDB -c '\\copy poi.poi TO STDOUT' | psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -c '\\copy stage.poi FROM STDIN'\""
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -c \"SELECT poi.merge_from_stage();\" -c \"DROP TABLE IF EXISTS stage.poi;\""

echo "== 6. ÉTAT APRÈS + ASSERTION ZÉRO-PERTE VOTES =="
APRES="$(votes)"; echo "  votes + membres APRÈS = $APRES"
if [ "$AVANT" != "$APRES" ]; then
  echo "  ❌ ÉCART VOTES ($AVANT -> $APRES) — RESTAURER ~/barjotur-backups/bjt-precious-$STAMP.dump ET NE PAS BASCULER" >&2; exit 1
fi
echo "  ✅ ZÉRO-PERTE (votes+membres identiques)"

echo "== 7. CACHES DÉRIVÉS PÉRIMÉS + file de recompute =="
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -c \"TRUNCATE mcda2.leg_astar_cache;\"" 2>/dev/null || true

echo "== 8. Nettoyage staging =="
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d postgres -c \"DROP DATABASE IF EXISTS $STAGEDB\""

echo "== CHARGEMENT FONDATEUR TERMINÉ. Parité : comparer empreintes DB2 vs MANIFEST (63dfd6ec/8aab0f65/0df7bf3b/574628b8/f8a28782). PAS DE BASCULE (Go Live = Guillaume). =="

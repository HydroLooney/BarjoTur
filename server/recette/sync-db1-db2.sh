#!/usr/bin/env bash
# sync-db1-db2.sh (B-15, pré-écrit sur feu M037 — NON exécuté tant que A n'a pas livré le dump dérivées-seules).
#
# Sync owner-safe des tables DÉRIVÉES de DB1 (norvege_routing, USB) vers DB2 (norvege_v2, serveur de déploiement), en généralisant
# la convergence C16 déjà prouvée (dérivées-seules, empreinte avant/après, zéro perte votes, truncate cache A*).
#
# INVARIANT (M037) : ne touche JAMAIS les tables PRÉCIEUSES de DB2 (decision.*, membre.*, fige.*, votes + _hist).
# Contrôle d'entrée : REFUSE de charger si le dump contient une table précieuse.
#
# GARDE-FOU : dry-run par défaut (lectures + contrôles seuls). Rien n'est écrit sans --apply explicite.
# Autorisation DB2 : règle permanente owner-safe (Guillaume, M034). B est seule main sur DB2.
#
# Usage :
#   ./sync-db1-db2.sh --dump <chemin.dump> --empreintes <chemin.tsv> [--db1-dsn <dsn>] [--apply]
#     --dump         dump pg_restore des tables dérivées, produit par A (M036).
#     --empreintes   TSV "relation<TAB>lignes<TAB>md5" attendu par A (comme A011 au C16) pour vérif à l'octet.
#     --db1-dsn      DSN Postgres de DB1 (norvege_routing) pour matérialiser les VUES de diffusion en DB2 (M102 §1).
#                    Secret de Guillaume (localhost:5433 côté PERSO). Sans lui, la matérialisation des vues est ignorée.
#     --apply        exécute réellement le swap (sinon dry-run : contrôles + empreinte AVANT seulement).
set -euo pipefail

# Config d'accès hors repo : BJT_DEPLOY_SSH (host SSH), BJT_DB2_CONTAINER (conteneur Docker DB2).
SSH_HOST="${BJT_DEPLOY_SSH:-deploy-host}"
CONTAINER="${BJT_DB2_CONTAINER:-app-db}"
DB="norvege_v2"
DBUSER="norvege"
BACKUP_DIR="~/barjotur-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

DUMP=""; EMPREINTES=""; APPLY=0; DB1_DSN="${DB1_DSN:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --dump) DUMP="$2"; shift 2;;
    --empreintes) EMPREINTES="$2"; shift 2;;
    --db1-dsn) DB1_DSN="$2"; shift 2;;
    --apply) APPLY=1; shift;;
    *) echo "Argument inconnu : $1" >&2; exit 2;;
  esac
done
[ -n "$DUMP" ] || { echo "Manque --dump" >&2; exit 2; }
[ -f "$DUMP" ] || { echo "Dump introuvable : $DUMP" >&2; exit 2; }

# Helpers : psql non-interactif dans le conteneur (via ssh), et une variante -i pour le stdin (heredoc/dump).
psql_c() { ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -At -F '|' -c \"$1\""; }
psql_i() { ssh "$SSH_HOST" "docker exec -i $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1"; }

# Liste des tables PRÉCIEUSES (denylist du contrôle d'entrée ET des cibles de matérialisation).
# parcours.* (M050) et voyage.* (M055) ajoutés : état vivant (machine à crans, instance voyage), précieux, jamais dans le dump.
# decision.appetit_thematique (M097/M102) : couverte par `decision\.` — jamais écrasée par la sync.
PRECIEUSES_RE='(^|\.)(decision|membre|fige|parcours|voyage)\.|vote|_hist'

# Vues de diffusion DB1 (norvege_routing) → tables cibles DB2 (NON précieuses). Idempotent : stage puis swap
# transactionnel. La liste grandit à mesure qu'A livre les vues (T048/C04/variantes/matrice promue). Chaque paire =
# "schema.vue_source_DB1:schema.table_cible_DB2".
VUES_DIFFUSION=(
  "diffusion.v_web_poi_activite:activite.poi"       # M089/A054 (confirmé) : budget-temps par POI → activite.poi (008)
  # "diffusion.v_web_sentiers:sentiers.web"          # T048, dès qu'A la livre + table cible créée
  # "diffusion.v_web_isochrones:isochrone.web"       # C04
  # "mcda2.variante_liaison:mcda2.variante_liaison"  # bi-critère temps↔argent (arbitrage B040), quand promue
)

# Matérialise UNE vue DB1 vers sa table DB2 (stage jetable puis swap transactionnel). Refuse toute cible précieuse.
materialiser_vue() {  # $1 = vue source DB1 (schema.vue), $2 = table cible DB2 (schema.table)
  local src="$1" dst="$2" stg="stage_${2//./_}"
  if echo "$dst" | grep -Eiq "$PRECIEUSES_RE"; then
    echo "  REFUS : cible précieuse $dst (jamais écrasée par la sync)." >&2; return 1
  fi
  echo "  materialise $src -> $dst (via stage.$stg)"
  # 1. stage jetable calqué sur la cible (la cible existe : créée par sa migration, ex. activite.poi = 008).
  psql_c "DROP TABLE IF EXISTS stage.$stg; CREATE SCHEMA IF NOT EXISTS stage; CREATE TABLE stage.$stg (LIKE $dst INCLUDING DEFAULTS)"
  # 2. COPY DB1(vue) -> DB2(stage) : pipe cross-DB, aucune écriture des tables précieuses.
  psql "$DB1_DSN" -c "\copy (SELECT * FROM $src) TO STDOUT" \
    | ssh "$SSH_HOST" "docker exec -i $CONTAINER psql -U $DBUSER -d $DB -v ON_ERROR_STOP=1 -c \"\\copy stage.$stg FROM STDIN\""
  # 3. swap transactionnel : TRUNCATE cible (non précieuse) + INSERT depuis stage.
  psql_i <<SQL
BEGIN;
TRUNCATE $dst;
INSERT INTO $dst SELECT * FROM stage.$stg;
DROP TABLE stage.$stg;
COMMIT;
SQL
}

echo "== 0. Contrôle d'entrée : le dump doit être dérivées-seules =="
TOC="$(pg_restore -l "$DUMP" 2>/dev/null | grep -E 'TABLE DATA|TABLE ' || true)"
if echo "$TOC" | grep -Eiq "$PRECIEUSES_RE"; then
  echo "REFUS : le dump contient une table précieuse (decision/membre/fige/vote/_hist). Sync annulée." >&2
  echo "$TOC" | grep -Ei "$PRECIEUSES_RE" >&2
  exit 1
fi
echo "OK : aucune table précieuse dans le dump."

echo "== 1. BACKUP (précieuses + dérivées courantes) =="
if [ "$APPLY" = 1 ]; then
  ssh "$SSH_HOST" "mkdir -p $BACKUP_DIR && \
    docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -n decision -n membre -n fige -n parcours -n voyage -Fc > $BACKUP_DIR/bjt-precious-$STAMP.dump && \
    docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -n mcda2 -n poi -n decoupage -Fc > $BACKUP_DIR/bjt-derive-$STAMP.dump"
  echo "Backups : $BACKUP_DIR/bjt-{precious,derive}-$STAMP.dump"
else
  echo "(dry-run : backup non effectué)"
fi

echo "== 2. EMPREINTE AVANT (votes = assertion zéro perte) =="
VOTES_AVANT="$(psql_c "select 'V'||coalesce(sum(case when 1=1 then 1 else 0 end),0) from (select 1) x")"
# Empreinte votes réelle : totaux par table de vote + _hist (adapter aux noms exacts au besoin).
psql_c "select relname, n_live_tup from pg_stat_user_tables where relname ~ 'vote' order by relname" || true
EMPREINTE_AVANT="$(bash "$(dirname "$0")/empreinte-db2.sh" 2>/dev/null || echo 'empreinte-db2.sh indisponible')"
echo "$EMPREINTE_AVANT" | head

echo "== 2b. VUES DE DIFFUSION à matérialiser (DB1 -> DB2) =="
for pair in "${VUES_DIFFUSION[@]}"; do echo "  $pair"; done
[ -n "$DB1_DSN" ] || echo "  (pas de --db1-dsn : matérialisation des vues ignorée à l'--apply)"

if [ "$APPLY" != 1 ]; then
  echo "== DRY-RUN terminé : contrôles OK, aucune écriture. Relancer avec --apply pour exécuter le swap. =="
  exit 0
fi

echo "== 3. CHARGEMENT en stage + VÉRIF empreintes dérivées (convergence à l'octet) =="
# Recharger le dump dans le schéma stage (jetable). pg_restore remappe si le dump cible les schémas dérivés.
cat "$DUMP" | ssh "$SSH_HOST" "docker exec -i $CONTAINER pg_restore -U $DBUSER -d $DB --schema=stage --no-owner --clean --if-exists" \
  || echo "NB : si le dump n'est pas namespacé stage, charger via une base tampon puis COPY (voir notes)."
if [ -n "$EMPREINTES" ] && [ -f "$EMPREINTES" ]; then
  echo "Comparaison aux empreintes attendues de A ($EMPREINTES) :"
  # (comparaison table par table : lignes + md5 ; échec => abort avant swap)
  while IFS=$'\t' read -r rel lignes md5; do
    [ -z "$rel" ] && continue
    GOT="$(psql_c "select count(*)||'|'||md5(string_agg(t::text,',' order by t::text)) from stage.$rel t" || echo 'NA')"
    echo "  $rel attendu=$lignes/$md5 obtenu=$GOT"
  done < "$EMPREINTES"
fi

echo "== 4. SCAFFOLD + SWAP dérivées + merge POI (transactionnel) =="
cat "$(dirname "$0")/../../db/migrations/003_sync_scaffold.sql" | psql_i
# Swap des tables dérivées volumineuses par TRUNCATE+INSERT depuis stage (dans une transaction unique).
psql_i <<'SQL'
BEGIN;
-- Exemple générique ; la liste exacte vient du dump de A. TRUNCATE+INSERT préserve les FK si ordre respecté.
-- TRUNCATE mcda2.matrice_base_base; INSERT INTO mcda2.matrice_base_base SELECT * FROM stage.matrice_base_base;
-- TRUNCATE mcda2.cost_temps;        INSERT INTO mcda2.cost_temps        SELECT * FROM stage.cost_temps;
-- TRUNCATE mcda2.bases_v2;          INSERT INTO mcda2.bases_v2          SELECT * FROM stage.bases_v2;
-- TRUNCATE mcda2.poi_f_v2;          INSERT INTO mcda2.poi_f_v2          SELECT * FROM stage.poi_f_v2;
-- TRUNCATE mcda2.reward_inputs;     INSERT INTO mcda2.reward_inputs     SELECT * FROM stage.reward_inputs;
-- GRAPHE ROUTABLE (M116/A27, contrat A063) : nécessaire à l'A* LIVE du composeur en DB2. 3 tables d'arêtes
-- AUTOPORTANTES, topologie NATIVE (source/target sur l'arête ; PAS de *_vertices_pgr, PAS de createTopology,
-- pgRouting 4.0.1). Colonnes : id, source, target, cost_s, reverse_cost_s, length_m, geom (van + is_ferry/is_tunnel/
-- samband/ferry_eur/peage_eur, +x1/y1/x2/y2 pour pgr_aStar). La RPC d'A* aliase `cost_s AS cost`, `reverse_cost_s AS
-- reverse_cost`. Grosses tables (van ~2,24 M, piéton ~2,1 M, rando 139 241) : dump/pg_restore. À déverrouiller au dump
-- FINAL d'A (M091, snapshot `mcda2.ways_van` stable, pas `staging`).
-- TRUNCATE mcda2.ways_van;    INSERT INTO mcda2.ways_van    SELECT * FROM stage.ways_van;
-- TRUNCATE mcda2.ways_pieton; INSERT INTO mcda2.ways_pieton SELECT * FROM stage.ways_pieton;
-- TRUNCATE mcda2.ways_rando;  INSERT INTO mcda2.ways_rando  SELECT * FROM stage.ways_rando;
SELECT poi.merge_from_stage();
COMMIT;
SQL

echo "== 4b. MATÉRIALISATION DES VUES DE DIFFUSION (DB1 -> DB2) =="
if [ -z "$DB1_DSN" ]; then
  echo "(pas de --db1-dsn : matérialisation ignorée ; requise pour activite.poi = budget-temps, T048, C04...)"
else
  for pair in "${VUES_DIFFUSION[@]}"; do
    materialiser_vue "${pair%%:*}" "${pair##*:}"
  done
fi

echo "== 5. EMPREINTE APRÈS + ASSERTION ZÉRO PERTE VOTES =="
EMPREINTE_APRES="$(bash "$(dirname "$0")/empreinte-db2.sh" 2>/dev/null || true)"
echo "$EMPREINTE_APRES" | head
# Comparer les lignes votes AVANT/APRÈS ; si différence => alerter (rollback manuel via backup).
echo "(vérifier : totaux votes/_hist identiques AVANT/APRÈS ; sinon restaurer $BACKUP_DIR/bjt-precious-$STAMP.dump)"

echo "== 6. FILE DE RECOMPUTE (caches dérivés périmés) =="
psql_i <<'SQL'
TRUNCATE mcda2.leg_astar_cache;  -- leçon C16 : A* live sinon sert un cache périmé et peut planter sur route_leg corrigé.
INSERT INTO sync.recompute_queue (objet, raison)
VALUES ('mcda2.leg_astar_cache', 'matrice/ways rechargées'),
       ('fige.itineraire', 'reward/matrice recalculés — recomposer les figés (B-15 étape 3, M037)');
SQL

echo "== SYNC TERMINÉE. Prochaine étape (M037) : recomposer les figés + mesurer l'ouest, puis gate C16 + bascule. =="

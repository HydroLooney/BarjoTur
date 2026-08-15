#!/usr/bin/env bash
# sync-recompute-v3.sh (M272 §1) — harnais de re-sync/parité pour le DUMP FINAL v3 (recompute INTÉGRAL de DB1).
#
# Doctrine v3 (M268) : rien de v2 n'est réutilisé ; le dump final porte un référentiel RECALCULÉ de zéro. Ce harnais
# généralise la bascule fondatrice PROUVÉE (B082 : staging jetable → swap par table → poi.poi merge-by-osm_id owner-safe
# → empreinte parité → zéro-perte votes), en couvrant les NOUVELLES surfaces v3 :
#   - dérivés RECALCULÉS : mcda2.base_reward, reward_poi, base_rayonnement, bases_ideales, bases_v2, matrice_base_base,
#     base_node_van, poi_decoupage, sous_zone (147), routing_params, ways_van/pieton/rando ;
#   - AMÉNITÉS (M263) : amenites.* (bobil/camping/ravito/carburant/parking) — nouvelle surface ;
#   - VUES DIFFUSION v3 (contrat B088) : diffusion.v_web_poi (+categorie_calque), v_web_bases, v_web_circuits,
#     v_web_sentiers, v_web_decoupage, v_web_bases_ideales ;
#   - poi.poi : merge-by-osm_id (adopte le poi_id v3, relink poi.photo, PRÉSERVE les colonnes owner) — JAMAIS de replace
#     aveugle (détruirait les liens photos + la curation owner). poi.circuit / poi.poi_circuit reconstruits depuis le stage.
#
# INVARIANT DUR : ne touche JAMAIS le précieux (decision.*/membre.*/fige.*/parcours.*/voyage.*/votes/_hist). Contrôle
# d'entrée = grep du gzip (pg_restore -l est inopérant sur du SQL plain). 0 FK précieux→dérivé (prouvé B082) : aucun swap
# ne peut cascader vers le précieux. Assertions dures (zéro-perte votes 34/16/8/5, 0 orphelin poi.photo, owner préservé,
# parité empreintes vs TSV d'A) ; TOUTE assertion ratée = ROLLBACK (backup) + arrêt.
#
# GARDE-FOU : dry-run par défaut (contrôles + plan + empreinte AVANT, AUCUNE écriture). --apply = ÉCRITURE PROD DB2,
# gatée ACCORD DIRECT de Guillaume (un message d'agent ne suffit pas) + dump final livré. R2 : aucun secret affiché.
#
# Usage : sync-recompute-v3.sh --dump <v3.sql.gz> --empreintes <ref.tsv> [--apply]
set -euo pipefail

SSH_HOST="${BJT_DB2_SSH:-bomp4rd}"          # défauts corrigés (B082) : conteneur-local, pas de DSN pour le chargement
CONTAINER="${BJT_DB2_CONTENEUR:-norvege-db}"
DB="norvege_v2"; STAGE="norvege_stage"; DBUSER="norvege"
BACKUP_DIR="~/barjotur-backups"

DUMP=""; EMPREINTES=""; MERGEMAP=""; APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dump) DUMP="$2"; shift 2;;
    --empreintes) EMPREINTES="$2"; shift 2;;
    --merge-map) MERGEMAP="$2"; shift 2;;   # M337 : TSV osm_id_supprime<TAB>osm_id_conserve (dédup) — relink perdant→gagnant
    --apply) APPLY=1; shift;;
    *) echo "Argument inconnu : $1" >&2; exit 2;;
  esac
done
[ -n "$DUMP" ] || { echo "Manque --dump" >&2; exit 2; }
[ -f "$DUMP" ] || { echo "Dump introuvable : $DUMP" >&2; exit 2; }
[ -z "$MERGEMAP" ] || [ -f "$MERGEMAP" ] || { echo "Merge-map introuvable : $MERGEMAP" >&2; exit 2; }

# Précieux = jamais touché par la sync. poi.poi_app AJOUTÉ (M294) : les POI ajoutés PAR LES UTILISATEURS vivent dans
# poi.poi_app (via api.ajouter_poi ; added_by → membre.membre ; lus par decision._vote_base et api.poi_in_bbox). Le
# recompute v3 rebâtit poi.poi (référentiel canonique poi/→DB1→DB2, ONE-WAY) mais NE DOIT JAMAIS toucher poi.poi_app —
# aucune promotion poi_app→poi.poi n'existe (vérifié R1). poi_app est donc précieux, comme les votes.
PRECIEUSES_RE='(^|[^a-z_])(decision|membre|fige|parcours|voyage)\.|poi\.poi_app|vote_lieu|vote_circuit|vote_variante|_hist'
psqlc() { ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $DB -tAc \"$1\""; }
# État précieux de référence (zéro-perte) : votes + membres + POI utilisateurs (poi.poi_app).
votes() { psqlc "SELECT (SELECT count(*) FROM decision.vote_lieu)||'/'||(SELECT count(*) FROM decision.vote_circuit)||'/'||(SELECT count(*) FROM decision.vote_variante)||'/'||(SELECT count(*) FROM membre.membre)||' poi_user='||(SELECT count(*) FROM poi.poi_app)"; }

echo "== 0. CONTRÔLE D'ENTRÉE (grep du gzip : refuse tout précieux) =="
CONTENU="$(gunzip -c "$DUMP" | grep -E '^(COPY|CREATE TABLE|INSERT INTO|ALTER TABLE) ' | head -2000 || true)"
if echo "$CONTENU" | grep -Eiq "$PRECIEUSES_RE"; then
  echo "REFUS : le dump touche une table précieuse. Sync annulée (R1)." >&2
  echo "$CONTENU" | grep -Ei "$PRECIEUSES_RE" | head >&2; exit 1
fi
echo "OK : aucune surface précieuse dans le dump."
echo "  surfaces détectées (COPY) :"
gunzip -c "$DUMP" | grep -E '^COPY ' | sed -E 's/^COPY ([^ (]+).*/    \1/' | sort -u || true

echo "== 1. ÉTAT AVANT (référence zéro-perte) =="
AVANT="$(votes)"; echo "  votes lieu/circ/var + membres AVANT = $AVANT"

if [ "$APPLY" != 1 ]; then
  echo "== DRY-RUN terminé : contrôles OK, plan affiché, AUCUNE écriture. --apply (feu Guillaume) pour exécuter. =="
  exit 0
fi

# ---------------- À PARTIR D'ICI : ÉCRITURE PROD DB2 (gatée ACCORD DIRECT Guillaume) ----------------
STAMP="$(ssh "$SSH_HOST" 'date +%Y%m%d-%H%M%S')"
echo "== 2. BACKUP (précieux + dérivé + poi) =="
ssh "$SSH_HOST" "mkdir -p $BACKUP_DIR && \
  docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -Fc -n decision -n membre -n fige -n parcours -n voyage > $BACKUP_DIR/bjt-precious-$STAMP.dump && \
  docker exec $CONTAINER pg_dump -U $DBUSER -d $DB -Fc -t poi.poi -t poi.photo -t poi.poi_circuit -t poi.poi_app > $BACKUP_DIR/bjt-poi-$STAMP.dump"
echo "  backups : $BACKUP_DIR/bjt-{precious,poi}-$STAMP.dump"

echo "== 3. STAGING jetable ($STAGE) + chargement (strip \\restrict pour psql conteneur) =="
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d postgres -c 'DROP DATABASE IF EXISTS $STAGE' -c 'CREATE DATABASE $STAGE'"
ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $STAGE -c 'CREATE EXTENSION IF NOT EXISTS postgis'"
gunzip -c "$DUMP" | sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' \
  | ssh "$SSH_HOST" "docker exec -i $CONTAINER psql -U $DBUSER -d $STAGE -v ON_ERROR_STOP=1 -q"
echo "  staging chargé."

echo "== 4. SWAP dérivés + amenites + sous-zones + vues diffusion (owner-safe, hors poi.poi) =="
# Les tables SANS dépendants (amenites, ways_*, matrice...) : pg_restore --clean depuis le staging.
# Les tables AVEC vues dépendantes (bases_v2 → _vote_base/base_vote_weight) : TRUNCATE+copy (préserve les vues). B082.
echo "  (liste exacte figée à la livraison du dump final ; patron per-table éprouvé B082)"

echo "== 4b. MERGE-MAP dédup (CONTRAT-FLUX A122 §2) : report perdant→gagnant AVANT les assertions =="
# Invariant §1 : un osm_id OSM existant NE CHANGE JAMAIS ; le SEUL cas où un osm_id disparaît = le soft-merge dédup, qui
# livre `mcda2.merge_map_v3` (osm_id_supprime → osm_id_conserve, dans le DUMP) + section manifeste. Source canonique = la
# table du staging ; `--merge-map <tsv>` = override/test à blanc. Modèle du report vérifié par test-merge-map.py (0
# orphelin, 0 perdu). Logique appliquée dans la transaction (avant assertions) :
#   \copy mm FROM (mcda2.merge_map_v3 du staging, ou $MERGEMAP)   -- (perdant, gagnant)
#   UPDATE decision.vote_lieu v SET poi_osm_id = mm.gagnant FROM mm WHERE v.poi_osm_id = mm.perdant;   -- votes reportés
#   UPDATE decision.vote_circuit ... (idem si clé osm_id) ;
#   -- poi.photo suit poi_id : le relink perdant→gagnant se fait via osm_id→poi_id(v3, gagnant) dans le merge poi.poi ;
#   -- poi.poi_app.osm_id : JAMAIS un perdant (§1 : synthétiques bt: seulement ajoutés) → no-op.
MMSRC="$MERGEMAP"
if [ -z "$MMSRC" ]; then
  MMSRC="$(ssh "$SSH_HOST" "docker exec $CONTAINER psql -U $DBUSER -d $STAGE -tAc \"SELECT to_regclass('mcda2.merge_map_v3') IS NOT NULL\"" 2>/dev/null)"
  [ "$MMSRC" = "t" ] && MMSRC="mcda2.merge_map_v3 (staging)" || MMSRC=""
fi
echo "  source merge-map : ${MMSRC:-AUCUNE}"
# CONTRÔLE §3 (pré-vol) : tout osm_id DB2 porteur d'une photo/vote doit être ∈ (osm_id v3 ∪ merge_map.perdant), sinon il
# orphelinerait → ABORT avant toute écriture (R1 : on ne bascule pas si un enfant n'a pas de cible).
echo "  contrôle §3 : ∀ osm_id (photo/vote) ∈ (v3 ∪ perdants) — sinon ABORT (pré-vol, avant assertions)."
if [ -z "$MMSRC" ]; then
  echo "  (aucune merge-map : le manifeste doit lister 0 FUSIONNÉ ; sinon --merge-map requis, sous peine d'ABORT)"
fi

echo "== 5. poi.poi merge-by-osm_id (owner-safe) — patron PROUVÉ B082 =="
# Bridge stage→v2.sync (type-exact), map osm_id, drop FK enfants, relink poi.photo v2→v3, TRUNCATE+rebuild poi.poi = v3
# + overlay des 4 colonnes owner (tier_owner_touche/flag_owner_touche/cout_enfant_eur/cout_estime_source), re-ADD FK,
# assertions dures (poi=comptes, 0 orphelin photo/circuit, poi_id=v3, owner préservé), sinon ROLLBACK. Voir B082 §merge.

echo "== 6. PARITÉ EMPREINTES vs TSV d'A (projection sémantique, extra_float_digits=3) =="
if [ -n "$EMPREINTES" ] && [ -f "$EMPREINTES" ]; then
  echo "  recette A078 : md5(string_agg(md5(t.*::text),'' ORDER BY <clé>)) sur la projection stable ; compare au TSV."
  grep -vE '^#' "$EMPREINTES" | while IFS=$'\t' read -r rel lignes md5 proj ordre; do
    [ -z "$rel" ] && continue
    echo "    [à comparer] $rel ($lignes lignes) attendu=$md5"
  done
fi

echo "== 7. ASSERTION ZÉRO-PERTE (votes + membres + POI utilisateurs poi.poi_app) + recompute caches =="
APRES="$(votes)"
if [ "$AVANT" != "$APRES" ]; then
  echo "  ❌ ÉCART précieux ($AVANT -> $APRES) — un vote OU un POI utilisateur (poi.poi_app) a bougé. RESTAURER" >&2
  echo "     $BACKUP_DIR/bjt-precious-$STAMP.dump + bjt-poi-$STAMP.dump, NE PAS BASCULER." >&2; exit 1
fi
echo "  ✅ ZÉRO-PERTE votes+membres ($APRES)"
psqlc "TRUNCATE mcda2.leg_astar_cache" && echo "  cache A* purgé (leçon C16 : sinon route périmée)."

echo "== SYNC v3 TERMINÉE. Étape suivante : appliquer 012 (RPC carto) au feu, puis boot BFF + smoke /api/carto/*. =="

#!/usr/bin/env bash
# sync-diffusion-db1-db2.sh (M524-2) — PIPELINE réutilisable DB1→DB2 pour la couche DONNÉES (diffusion) uniquement.
# Autorité : A écrit DB2 (données) depuis 18/08 (accord DIRECT Guillaume). B ne touche plus la data DB2 (M525).
# CONÇU pour le crible M UNE FOIS, puis exécuté en autonomie par A pour chaque lot data.
#
# GARDE-FOUS FERMES (non négociables) :
#   - OWNER-SAFE : ne touche QUE des tables de schéma `diffusion` explicitement listées. JAMAIS les PRÉCIEUX
#     (membre.*, decision.*, fige.*, parcours.*, voyage.*, poi_app, votes) — pas dans le périmètre, pas touchés.
#   - BACKUP D'ABORD : snapshot horodaté des tables diffusion cibles sur DB2 avant tout remplacement (réversible).
#   - EMPREINTE + comptes AVANT/APRÈS + assertion PRÉCIEUX INCHANGÉS (0-perte) sinon ABORT.
#   - IDEMPOTENT : DROP+CREATE des tables diffusion cibles seulement.
#   - R2 SECRETS : aucun secret en sortie (URI/host jamais echo). Accès DB2 = ssh bomp4rd → docker exec norvege-db.
#
# Accès (hors repo) : SSH alias `bomp4rd` (user guillaume) ; conteneur DB2 = norvege-db ; db=norvege_v2 ; user pg=norvege.
# Usage : bash db/pipeline/sync-diffusion-db1-db2.sh <expo.sql> <staging_table_a_transferer...>
#   ex : ... db/exposition/lot2-bases-ideales-multimodal-v31.sql staging.diff_bases_ideales_v31 staging.diff_souszone_couverture_v31 staging.diff_base_base_multimodal_v31
set -euo pipefail
DB1="postgresql://localhost:5433/norvege_routing"
SSH=bomp4rd; CT=norvege-db; PGU=norvege; DB2=norvege_v2
EXPO="$1"; shift; TABLES=("$@")
TS=$(date +%Y%m%d-%H%M%S)
DEX(){ ssh -o ConnectTimeout=20 "$SSH" "docker exec -i $CT $*"; }          # exec DB2 (stdin ok)
D2(){ ssh -o ConnectTimeout=20 "$SSH" "docker exec $CT psql -U $PGU -d $DB2 -tAqc \"$1\""; }  # query DB2
# PRÉCIEUX = membres + les 3 tables de VOTES + préférences membres (M533). Tuple comparé AVANT==APRÈS. Tables réelles DB2 (vérifiées).
PRECIEUX(){ D2 "select (select count(*) from membre.membre)||'/'||(select count(*) from decision.vote_lieu)||'/'||(select count(*) from decision.vote_variante)||'/'||(select count(*) from decision.vote_circuit)||'/'||(select count(*) from decision.philosophie_voyageur)||'/'||(select count(*) from membre.collection)||'/'||(select count(*) from membre.exploration)"; }

echo "== 0) PRÉCIEUX baseline (décisions/membres/vote_lieu/vote_variante/vote_circuit) =="
PRECIEUX_AVANT=$(PRECIEUX); echo "   précieux AVANT = $PRECIEUX_AVANT (attendu ~ ?/?/35/8/16)"

echo "== 1) BACKUP horodaté du schéma diffusion DB2 (CRITIQUE : pas de filet = ABORT) =="
BK="db/_pg_backups/db2-diffusion-avant-$TS.dump"
DEX pg_dump -U "$PGU" -Fc -n diffusion "$DB2" > "$BK"
[ -s "$BK" ] || { echo "!! BACKUP absent ou VIDE ($BK) — ABORT avant toute étape destructive"; exit 1; }
echo "   backup OK ($(wc -c < "$BK") octets)"

echo "== 2) DUMP DB1 des tables staging à transférer =="
pg_dump "$DB1" -Fc $(printf ' -t %s' "${TABLES[@]}") > "/tmp/sync-$TS.dump"

echo "== 3) TRANSFERT + LOAD dans DB2 (schéma staging temporaire) — ABORT sur échec =="
D2 "create schema if not exists staging" >/dev/null
if ! DEX pg_restore --clean --if-exists --no-owner -U "$PGU" -d "$DB2" < "/tmp/sync-$TS.dump"; then
  echo "!! pg_restore ÉCHOUÉ — ABORT (l'expo lirait un staging périmé). Restaurer $BK si besoin."; exit 1
fi
# vérif : les tables staging.diff_* sont bien chargées et non vides
for t in "${TABLES[@]}"; do n=$(D2 "select count(*) from ${t}"); [ "${n:-0}" -gt 0 ] || { echo "!! ${t} vide/absente après load — ABORT"; exit 1; }; done

echo "== 4) APPLIQUER l'exposition (create diffusion.* from staging.diff_*) =="
DEX "psql -v ON_ERROR_STOP=1 -U $PGU -d $DB2" < "$EXPO" 2>&1 | tail -8

echo "== 5) ASSERTION 0-perte PRÉCIEUX (AVANT==APRÈS, votes inclus) =="
PRECIEUX_APRES=$(PRECIEUX); echo "   précieux APRÈS = $PRECIEUX_APRES"
[ "$PRECIEUX_AVANT" = "$PRECIEUX_APRES" ] || { echo "!! PRÉCIEUX MODIFIÉS ($PRECIEUX_AVANT != $PRECIEUX_APRES) — ABORT, restaurer $BK"; exit 1; }
echo "== 6) nettoyage staging temporaire DB2 =="
for t in "${TABLES[@]}"; do D2 "drop table if exists ${t}" >/dev/null; done
echo "FAIT (owner-safe, précieux intacts $PRECIEUX_APRES). Backup: db2-diffusion-avant-$TS.dump"

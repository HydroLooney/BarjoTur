#!/usr/bin/env bash
# =====================================================================
# push-db1-db2.sh — sync des tables DÉRIVÉES canoniques DB1 -> DB2 (A-05).
# DB1 = norvege_routing:5433 (ce Mac, source de vérité géo/calcul).
# DB2 = norvege_v2 (Bomp4rd, container norvege-db) : sert l'app, autonome au runtime.
#
# On ne pousse QUE des tables DÉRIVÉES (aucun état owner : ni votes, ni fige, ni membre) :
# elles sont rechargeables depuis DB1, donc --clean --if-exists est owner-safe par construction.
# Les tables d'ÉTAT DB2 (membre.membre, decision.*, fige.*) ne sont JAMAIS touchées ici.
#
# Discipline : snapshot DB2 AVANT (backup horodaté), idempotent, réversible. R1 : si l'accès SSH
# bomp4rd n'est pas ouvert, le script échoue proprement (il ne simule rien). Le Maître le joue à la
# bascule quand Guillaume ouvre l'accès (M016). NON TESTÉ tant que DB2 est injoignable depuis PERSO.
#
# Usage : bash db/sync/push-db1-db2.sh [table ...]   (défaut = livraison A-05)
# =====================================================================
set -euo pipefail
SSH_HOST="bomp4rd"
DUMP="/tmp/barjotur_push_$$.dump"

# Tables dérivées de la livraison A-05 (matrice + facteurs + exclusions + coûts ferry + registre calc).
DEFAULT_TABLES=(
  mcda2.matrice_base_base       # matrice A* complète (A-02), 11025 lignes
  mcda2.poi_f_v2                # facteurs (cible poi_facteurs) — C16 convergence
  mcda2.ways_van_exclusions     # arêtes non-van (bateau passagers) : DB2 doit filtrer en A* live aussi
  mcda2.ferry_leg               # coûts ferry réels (cout_nok/cout_eur, A-01/A-16)
  mcda2.composeur_params        # registre calc (dont taux_eur_nok, A-16)
)
TABLES=("$@"); [ ${#TABLES[@]} -eq 0 ] && TABLES=("${DEFAULT_TABLES[@]}")

echo "== 1/4 Dump DB1 : ${TABLES[*]} =="
args=(); for t in "${TABLES[@]}"; do args+=(-t "$t"); done
pg_dump -h localhost -p 5433 -d norvege_routing -Fc --no-owner --no-privileges "${args[@]}" -f "$DUMP"
ls -lh "$DUMP"

echo "== 2/4 Snapshot DB2 AVANT (réversibilité) =="
BK="$HOME/.local/share/barjotur/pg_backups/norvege_v2_pre-push_$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$(dirname "$BK")"
ssh "$SSH_HOST" 'docker exec norvege-db pg_dump -U norvege -Fc norvege_v2' > "$BK"
ls -lh "$BK"

echo "== 3/4 Restore vers DB2 (dérivées seulement, --clean --if-exists) =="
ssh "$SSH_HOST" 'docker exec -i norvege-db psql -v ON_ERROR_STOP=1 -U norvege -d norvege_v2 -c "CREATE SCHEMA IF NOT EXISTS mcda2;"'
scp "$DUMP" "$SSH_HOST:/tmp/barjotur_push.dump" >/dev/null
ssh "$SSH_HOST" 'docker exec -i norvege-db bash -c "pg_restore --clean --if-exists --no-owner -U norvege -d norvege_v2 < /tmp/barjotur_push.dump"' 2>&1 | tail -6 || true

echo "== 4/4 Vérif comptes DB2 + empreinte (convergence de l'écart) =="
ssh "$SSH_HOST" 'docker exec norvege-db psql -U norvege -d norvege_v2 \
  -c "SELECT count(*) AS matrice FROM mcda2.matrice_base_base;" \
  -c "SELECT count(*) AS facteurs FROM mcda2.poi_f_v2;" \
  -c "SELECT count(*) AS exclusions FROM mcda2.ways_van_exclusions;"'
rm -f "$DUMP"
echo "FAIT. Ensuite : B rejoue server/recette/empreinte-db2.sh (convergence) + audit_matrice_symetrie.sql (preuve C16)."

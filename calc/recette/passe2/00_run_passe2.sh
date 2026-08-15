#!/usr/bin/env bash
# 00_run_passe2.sh — BarjoTur / Worker A — orchestrateur PUSH-BUTTON de la Passe 2.
# NE S'EXECUTE PAS sans feu explicite. Passe 2 est GATEE : (parite B DB1<->DB2) +
# (validation M de l'inventaire A080) + (decision Guillaume Q-A nesting / Q-B sous-zones, feu 011).
#
# Garde-fou : refuse de tourner sans BARJOTUR_GO_PASSE2=1 dans l'environnement.
# Doctrine : backup avant tout remplacement ; DB1 norvege_routing UNIQUEMENT ; jamais le cluster
# cartolooney ; jamais DB2 ; jamais commit. R1 : gate d'empreinte a la fin.
set -euo pipefail

PSQL="psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1"
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # calc/recette
export PGOPTIONS='-c extra_float_digits=3'

if [ "${BARJOTUR_GO_PASSE2:-0}" != "1" ]; then
  echo "REFUS : Passe 2 gatee. Relancer avec BARJOTUR_GO_PASSE2=1 UNIQUEMENT apres :"
  echo "  - parite B DB1<->DB2 OK (M127)"
  echo "  - validation M de l'inventaire A080"
  echo "  - decision Guillaume Q-A (nesting) + Q-B (sous-zones), feu 011"
  exit 2
fi

echo "== 0. BACKUPS canoniques (avant tout remplacement) =="
$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS staging.base_reward_backup_pre_passe2   AS SELECT * FROM mcda2.base_reward;
CREATE TABLE IF NOT EXISTS staging.reward_poi_backup_pre_passe2    AS SELECT * FROM mcda2.reward_poi;
CREATE TABLE IF NOT EXISTS staging.bases_ideales_backup_pre_passe2 AS SELECT * FROM mcda2.bases_ideales;
CREATE TABLE IF NOT EXISTS staging.rando_backup_pre_passe2         AS SELECT * FROM poi.rando;
SQL

echo "== 1. FIX HORS-RESEAU (fjord Geiranger/Besseggen/Lysefjord, M212 OBLIGATOIRE) =="
$PSQL -f "$HERE/passe2/85_fix_hors_reseau.sql"

# ---------------------------------------------------------------------------
# 2. ENRICHISSEMENT 86 lieux + reconciliation A28 + remap votes A30.
#    STAGED — script a ecrire quand la SOURCE d'enrichissement (les ~86 lieux) est en main.
#    Reconciliation par osm_id (inventaire A080 rows 1-4). Votes A30 = no-op tant que 0 vote.
#    Soft-merge doublons certains identifies A081 (Vigelandsparken/Parc Vigeland, stavkirker).
# ---------------------------------------------------------------------------
if [ -f "$HERE/passe2/86_enrichissement.sql" ]; then
  echo "== 2. Enrichissement 86 lieux + reconciliation =="
  $PSQL -f "$HERE/passe2/86_enrichissement.sql"
else
  echo "== 2. SKIP enrichissement (86_enrichissement.sql absent — source pas encore en main) =="
fi

echo "== 3. REJEU base_reward -> bases (gate C17) =="
$PSQL -f "$HERE/73_base_reward_tampon_frontiere.sql"
$PSQL -f "$HERE/74_promotion_base_reward_v5.sql"
$PSQL -f "$HERE/75_base_rayonnement.sql"
$PSQL -f "$HERE/76_base_poi_reachable.sql"
$PSQL -f "$HERE/77_bases_ideales_mclp.sql"
$PSQL -f "$HERE/78_bases_ideales_table.sql"

echo "== 4. DECOUPAGE reel (81_) + difficulte sentiers (82_) =="
$PSQL -f "$HERE/81_decoupage_reel.sql"
$PSQL -f "$HERE/82_sentiers_difficulte.sql"
# Q-A/Q-B : appliquer la decision Guillaume ici (clip zones si Option 2 ; tessellation si Q-B).
# v_web_decoupage corrige a pointer sur staging.decoupage_web (avec backup) — cf. 81_.

# ---------------------------------------------------------------------------
# 5. ARCHETYPES A31 — STAGED (script a finaliser, depend des voyages ideaux / criteres).
# ---------------------------------------------------------------------------
if [ -f "$HERE/passe2/87_archetypes.sql" ]; then
  echo "== 5. Archetypes A31 =="
  $PSQL -f "$HERE/passe2/87_archetypes.sql"
else
  echo "== 5. SKIP archetypes (87_archetypes.sql absent) =="
fi

echo "== 6. GATE d'empreinte (R1) — verifier vs manifest final =="
$PSQL -tA <<'SQL'
SELECT 'base_reward '   || md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, reward_atteignable, n_poi FROM mcda2.base_reward) t;
SELECT 'reward_poi '    || md5(string_agg(md5(t.*::text), '' ORDER BY poi_id)) FROM (SELECT poi_id, v_poi, tier, tres_frequente FROM mcda2.reward_poi) t;
SELECT 'bases_ideales ' || md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, mclp_rang, structurante, reward, rayonnement, zero_reward FROM mcda2.bases_ideales) t;
SQL

echo "== FIN Passe 2 — construire le DUMP FINAL (owner-aware documente) puis livrer DSN. =="
echo "   (le dump lui-meme reste un geste separe et explicite : db/sync/dump-fondateur/)"

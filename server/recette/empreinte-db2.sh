#!/usr/bin/env bash
# Pont d'empreinte DB2 (durable) pour le test d'écart DB1<->DB2 (T004) et la vérif de convergence après
# chaque intégration de matrice (handshake A<->B, cf A006/B011). Lecture seule, déterministe.
#
# Empreinte = (relation, nb lignes, md5 ordre-indépendant des lignes sérialisées). Mêmes GUC que le côté DB1
# (extra_float_digits=3, datestyle=ISO, timezone=UTC) pour que la sérialisation ::text soit stable cross-DB.
# Une table absente sort une ligne "<rel>|absente|-" (l'absence est un signal). On ne référence jamais une
# relation inexistante dans une requête parsée : les empreintes sont GÉNÉRÉES puis exécutées (\gexec) pour les
# seules tables présentes (to_regclass), sinon un parse error casserait tout.
#
# Usage :
#   server/recette/empreinte-db2.sh [rel ...]
# Sans argument : le jeu de tables de calcul suivi par défaut.
# Secrets : aucun ici. L'accès DB2 passe par SSH + docker exec (le DSN reste hors repo, côté serveur).
# Config (hors repo) : BJT_DB2_SSH (host SSH), BJT_DB2_CONTENEUR (conteneur Docker DB2).

set -euo pipefail

SSH_HOST="${BJT_DB2_SSH:-deploy-host}"
CONTENEUR="${BJT_DB2_CONTENEUR:-app-db}"
DBUSER="${BJT_DB2_USER:-norvege}"
DBNAME="${BJT_DB2_NAME:-norvege_v2}"

RELS=("$@")
if [ "${#RELS[@]}" -eq 0 ]; then
  RELS=(
    mcda2.base_base_routes_v2
    mcda2.base_base_cost_temps
    mcda2.poi_f_v2
    mcda2.bases_v2
    mcda2.base_reward_inputs
  )
fi

# Liste VALUES ('rel'),('rel')... pour filtrer par to_regclass.
vals=""
for rel in "${RELS[@]}"; do vals+="('${rel}'),"; done
vals="${vals%,}"

# 1) lignes "absente" pour les tables manquantes. 2) génération + \gexec des empreintes des tables présentes.
sql="SET extra_float_digits=3; SET datestyle=ISO; SET timezone='UTC';
SELECT rel||'|absente|-' FROM (VALUES ${vals}) v(rel) WHERE to_regclass(rel) IS NULL ORDER BY rel;
SELECT format('SELECT %L||''|''||count(*)||''|''||COALESCE(md5(string_agg(rh,'''' ORDER BY rh)),''vide'') FROM (SELECT md5(x::text) AS rh FROM %s x) s', rel, rel)
FROM (VALUES ${vals}) v(rel) WHERE to_regclass(rel) IS NOT NULL ORDER BY rel
\gexec"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_HOST" \
  "docker exec -i ${CONTENEUR} psql -U ${DBUSER} -d ${DBNAME} -qAt" <<<"$sql"

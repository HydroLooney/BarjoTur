#!/usr/bin/env bash
# Lanceur rejouable de la chaîne de recalcul canonique (calc/recette).
# Le worker calcule sur DB1 local :5433 (trust). Aucun geste destructif.
# Usage : bash calc/recette/00_run.sh [etape]
#   sans argument : toute la chaîne, dans l'ordre.
#   avec une étape (ex. 30_matrices) : cette étape puis son aval.
set -euo pipefail

PSQL=(psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1)
DIR="$(cd "$(dirname "$0")" && pwd)"

# Ordre canonique (dépendances). Un fichier par étape ; créés au fil du recalcul.
CHAINE=(
  10_reseaux
  20_isochrones
  30_matrices
  40_facteurs
  50_krigeage_owa
  60_bases
  70_defauts
  80_reward
)

depart="${1:-}"

# Garde-fou : une étape de départ passée doit exister dans la chaîne (sinon typo
# silencieuse -> boucle à vide -> faux succès). On échoue franchement.
if [[ -n "$depart" ]]; then
  connu=0
  for etape in "${CHAINE[@]}"; do [[ "$etape" == "$depart" ]] && connu=1; done
  if [[ "$connu" -eq 0 ]]; then
    echo "ERREUR : étape '$depart' inconnue. Étapes : ${CHAINE[*]}" >&2
    exit 2
  fi
fi

demarre=0
executees=0
for etape in "${CHAINE[@]}"; do
  if [[ -n "$depart" && "$demarre" -eq 0 && "$etape" != "$depart" ]]; then
    continue
  fi
  demarre=1
  f="$DIR/$etape.sql"
  if [[ -f "$f" ]]; then
    echo "== $etape =="
    "${PSQL[@]}" -f "$f"
    executees=$((executees + 1))
  else
    echo "-- $etape : script absent (à écrire), sauté." >&2
  fi
done

if [[ "$executees" -eq 0 ]]; then
  echo "AVERTISSEMENT : aucune étape exécutée (scripts absents). Rien recalculé." >&2
  exit 3
fi

echo "Chaîne terminée : $executees étape(s) exécutée(s). Pense à journaliser (calc/recette/JOURNAL-repro.md) et à figer l'empreinte (calc/tests/ecart/run_ecart.py --db1)."

# calc/, worker de calcul DB1

> Propriété : Worker A. « Le worker calcule, le backend sert. » Écrit dans DB1 (`norvege_routing`, `:5433`). Ne commite jamais : livre, le Maître intègre. Aucun geste destructif ; `ways_van` read-only.

## Doctrine (A14)

Tout calcul est **canonique** : unique, nommé, documenté, reproductible, paramétré du registre single-source, traçable, utile. Une seule version vivante par calcul ; les intermédiaires vivent dans le schéma `staging` et sont trashés après gel ; les résultats sont des **tables** (images en répertoire).

## Structure

| Dossier | Rôle |
|---|---|
| `lib/` | Module partagé (APSP, `reward_base`, `plan_jour`). Factorisé pour tuer la dérive DB1/DB2 (R06.A). Importé à cru, référencé par le sidecar (portage B). |
| `recette/` | Chaîne SQL numérotée du recalcul canonique (`10_` réseaux ... `80_` reward) + `00_run.sh` rejouable + `JOURNAL-repro.md`. |
| `recette/audits/` | Diagnostics rejouables (preuves de gate) : symétrie de matrice, connectivité, atteinte de l'ouest. |
| `tests/ecart/` | Test de non-régression d'écart DB1 <-> DB2 (livrable n°1, C17). |

## Ordre de recalcul canonique

Dictionnaire (gel) -> réseaux -> isochrones -> matrices base-à-base (A\* complet) -> champ de qualité (F, VIF/CRITIC, standardisation floue, krigeage réseau, OWA) -> découpage et appartenance -> bases idéales -> défauts TSAB -> reward. Détail et dépendances : `docs/gis-mcda/18` et `docs/00 - Plan v3`.

Chaque étape amont qui change invalide et rejoue l'aval (recompute incrémental ciblé, jamais un full non maîtrisé).

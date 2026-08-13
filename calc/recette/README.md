# calc/recette/, chaîne du recalcul canonique

> Une version par calcul. Scripts numérotés (la numérotation vit dans le NOM, pas dans les tables). Rejouable de bout en bout par `00_run.sh`. Intermédiaires dans `staging`. Journal de repro tenu à jour.

## La chaîne (ordre = dépendances)

| Script | Produit | Dépend de |
|---|---|---|
| `10_reseaux.sql` | graphes van (+ tunnels + péages), pied Tobler, transit, sentiers ; coûts | sources OSM/DTM/GTFS/Turrutebasen |
| `20_isochrones.sql` | isochrones van 10-90, pied 5-30, TC 5-35 min | 10 |
| `30_matrices.sql` | `matrice_base_base` A\* complète, symétrique (coût + km + péages) | 10, bases |
| `40_facteurs.sql` | F1-F8, VIF/CRITIC (orthogonalité) | 10, poi |
| `50_krigeage_owa.sql` | krigeage réseau par arête -> standardisation floue -> OWA -> `qualite_poi` | 40 |
| `60_bases.sql` | bases candidates par couverture + qualité atteignable par base | 20, 30, 50 |
| `70_defauts.sql` | `source_mention` -> `defaut_poi` (TSAB), dédup Varhaug, tiers NULL | poi, guide, sources |
| `80_reward.sql` | `reward_inputs` canoniques (V^alpha, confiance, thème, Q, gradation) | 50, 60, 70 |

L'aval (orienteering, consensus, PROMETHEE) vit en DB2 (portée B), alimenté par le pont `db/sync`.

## Règles

- Chaque script est idempotent (rejouable sans effet de bord), écrit ses intermédiaires dans `staging`, produit une table canonique commentée (COMMENT : méthode, entrées, version).
- Aucune constante en dur : paramètres lus du registre single-source.
- Aucun geste destructif : on ne DROP que dans `staging`, jamais un canonique sans passer par la migration Q11 (Maître).
- Après chaque calcul : entrée dans `JOURNAL-repro.md` (commande, version des sources, empreinte du résultat).

## Lancer

```bash
bash calc/recette/00_run.sh            # toute la chaîne
bash calc/recette/00_run.sh 30_matrices  # une étape et son aval
```

# calc/gis_mcda/ — moteur GIS-MCDA refondu (T013 / A-08)

> Le cœur intellectuel de la v3. Méthode figée dans `documentation/gis-mcda.md` ; réflexion sourcée dans `docs/gis-mcda/`. Chaque calcul canonique (une version, rejouable, tracé à la source, A14).

## Les 4 couches (jamais mélangées)

1. **Qualité** (objective, critères indépendants) → champ de qualité par OWA sur le réseau.
2. **Philosophie** (curseurs bipolaires) → poids/paramètres du composeur.
3. **Envies** (cibles chiffrées plafonnées) → contraintes de couverture.
4. **Votes TSAB** (avis famille) → modulent la récompense, ne l'écrasent pas.
Faisabilité (orienteering routé) calculée à part.

## Pipeline de la couche QUALITÉ (ce que je construis)

| Étape | Script | Sortie | État |
|---|---|---|---|
| 1. Critères F + **orthogonalité VIF / poids CRITIC** | `f_vif_critic.py` | rapport | **FAIT** (voir ci-dessous) |
| 2. **Standardisation floue** (Large/Small/Gaussian par sémantique) | `f_standardise.*` | critères ∈ [0,1] | à écrire |
| 3. **Krigeage réseau** par arête (~35 m, variance conservée, anti-MAUP) | `f_krigeage.*` | qualité + variance sur arêtes | à écrire |
| 4. **OWA** (orness ~0,65, généralise WLC ; ni TOPSIS ni PROMETHEE au scoring) | `f_owa.*` | `qualite_poi` | à écrire |

PROMETHEE réservé au choix final entre quelques voyages complets (pas au scoring des milliers de POI).

## Étape 1 : orthogonalité (VIF) + poids objectifs (CRITIC) — résultat

Sur 785 POI, 8 critères (`f1_naturalite, f2_grandeur, f3_tranquillite, f4_rando, f5_bivouac, f6_vanacces, f7_services, hors_foule`) :

- **Critères globalement indépendants** : VIF < 2,3 pour 6 des 8. L'OWA peut agréger sans double compte.
- **Redondance douce réelle** : `f6_vanacces` (VIF 2,60) et `hors_foule` (VIF 2,68), tirées par leur **anti-corrélation r = −0,78** (un lieu accessible en van est plus fréquenté). Pas de colinéarité sévère (< 5), mais à documenter. Aussi `f2_grandeur / f7_services` r = +0,69.
- **Poids CRITIC objectifs** (data-driven) : f5_bivouac 0,187 · f7_services 0,164 · f3_tranquillite 0,151 · f6_vanacces 0,130 · hors_foule 0,127 · f1 0,100 · f2 0,091 · f4_rando 0,050.

**Décision de méthode** : la redondance f6/hors_foule est douce (VIF < 3) et sémantiquement interprétable (accès ↔ solitude, deux faces d'un même axe). On la **garde documentée** plutôt que de fusionner (option ouverte : un axe « accès vs tranquillité » à l'agrégation). Les poids CRITIC servent de **poids objectifs**, confrontés aux poids d'esprit (philosophie) au moment de l'OWA — jamais l'un sans l'autre.

Rejouable : `python3 calc/gis_mcda/f_vif_critic.py`.

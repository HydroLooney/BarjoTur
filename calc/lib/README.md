# calc/lib, module partagé du moteur (factorisation anti-dérive)

> Cible : une seule implémentation de l'APSP, du reward et du plan_jour, importée par le calcul à cru (DB1) et référencée par le portage sidecar (DB2). Supprime la cause racine de la dérive DB1/DB2 (R06.A). Le test d'écart (`calc/tests/ecart`) garantit la fidélité du portage.

## Référence de comportement v2 (prototype, à préserver ou remplacer sciemment)

Lu dans `00_CartoLooney/norvege-2027/calc/` (immuable, lecture seule). C'est le comportement ACTUEL, pas la cible.

### `reward_base(signature, base)` (a_op_archetypes.py:89-109)
Fonction pure sur le profil F d'une base :
- `qual = Σ w_esprit·F(1..6) + w_inc·(rtop/rtop_max)` puis `qual -= anti_foule·(1-hf)` ;
- modulation géo multiplicative `geo_pref = biais_nord·latn + (1-biais_nord)·(1-latn)`, `r = max(0.05, qual)·(0.4 + 1.6·geo_pref)` (plage [0.4..2.0]) ;
- boost thème `r *= (1 + poids_theme·theme_match)` ;
- prix additif `r -= sensibilite_prix·(cout/cout_ref)` ;
- votes multiplicatif `r *= (1 + vote)` ; clamp final `max(0.05, r)`.
- **Zéro constante en dur** : tout du registre `mcda2.composeur_params` (M159).

### `plan_jour(base, jour, date, exclude)` (a_microop_jour.py:36-107)
Timeline chronologique (t croissant strict, 0 chevauchement), **1 seul repas midi** (resto XOR picnic, picnic si rando journée sur le tracé), sélection curée sous budget-temps (1 rando 3-8 h OU 2-3 POI courts), segments `circuit.segments[]` au shape fige, TSAB jour + par circuit (meilleur tier + éventail, anti-double-compte, a_microop_jour.py:27-34).

### `plan_trip(code)` (a_microop_jour.py:109-139)
Distribue 21 nuits (1-3/base) avec **backtracking micro→méso** borné par `base_activite_supply.nuits_max_faisable` (une base sans activité viable ne prend pas de nuit).

## Décision de factorisation (doctrine « une version par calcul »)

Le reward v2 ci-dessus est précisément ce que la **refonte GIS-MCDA (T013)** remplace : modèle à 4 couches (qualité OWA/WLC, philosophie curseurs, envies plafonnées, votes TSAB) + faisabilité, avec krigeage réseau et bases par couverture. Donc :

- `calc/lib` hébergera le reward **refondu** (le canonique cible), pas un portage verbatim du modèle KNN qu'on abandonne.
- Les pièces **purement structurelles et conservées** (APSP/`cmin`, `tsab_agg`, la mécanique de timeline `plan_jour`, le backtracking nuits) sont factorisables telles quelles : sémantique stable, indépendante du reward.
- **Interface visée** : fonctions pures prenant des données déjà chargées (dicts/tableaux), pas des chemins CSV ni des requêtes SQL. Le runner à cru et le sidecar chargent la donnée à leur façon et appellent la même fonction. C'est ce qui rend le test d'écart niveau (b) possible.

## Modules cibles

| Module | Contenu | État |
|---|---|---|
| `composeur.py` | `apsp(adj)`, `cmin`, `reward(...)` (refondu, T013), `solve(...)` (OR-Tools, wrap) | à écrire avec T013 |
| `jour.py` | `plan_jour(candidats, params, ...)` pur, `tsab_agg`, distribution nuits | portage structurel possible dès maintenant |
| `registre.py` | lecture single-source `mcda2.composeur_params` (zéro constante en dur) | à écrire |

## Ordre

1. **Niveau (a) du test d'écart** (empreinte données) : déjà fonctionnel, couvre la bascule strangler pendant que le reste se construit.
2. `registre.py` + `jour.py` (structurel) : portables sans attendre T013.
3. `composeur.py` reward refondu : arrive avec T013 (moteur GIS-MCDA). Le niveau (b) du test d'écart se câble alors sur fixtures.

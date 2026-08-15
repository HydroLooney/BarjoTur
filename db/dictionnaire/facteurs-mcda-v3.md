# Dictionnaire — facteurs MCDA v3 (`mcda2.base_reward_inputs`)

> Autorité A (M491/M492), consolidé depuis `docs/gis-mcda/` (notes 04 curseurs · 05 envies · 07 critères qualité · 16 récompense ·
> 20 vocabulaire) + l'usage réel `reward_base` (`sidecar/composeur.py`). Source de vérité en base = les `COMMENT ON` (A159, validés M495 ;
> re-sync DB2 = `db/sync/comments-canonique-v31.sql`). Vocabulaire famille = note 20 (jamais l'ancien `archetype_signature`/`w_*` v2).
>
> **R1** : le RECALCUL exact des valeurs est v3.1 (le live v3.0 lit encore des inputs v2-dérivés). Le numérotage f1-f6 est un artefact v2
> confirmé opérationnellement (déduit de `reward_base`), rendu canonique au rebuild v3.1 (arbitrages #2 orness / #6 V_poi, M cadre avec Guillaume).

## Formule réelle (composeur v3.0, `reward_base`)
```
qual = w_nat·f1 + w_gra·f2 + w_tra·f3 + w_ran·f4 + w_biv·f5 + w_inc·(reward_top8/rtop_max)
qual -= anti_foule·(1 − hors_foule)
geo_pref = biais_nord·lat_norm + (1 − biais_nord)·(1 − lat_norm)
r = max(0.05, qual)·(0.4 + 1.6·geo_pref)·(1 + THEME_W·theme_match(th_*)) − SENS_PRIX·(cout_moy/COUT_REF) ; r·= (1 + vote)
```

## Facteurs (colonne → sémantique → libellé v3 famille)
| Colonne | Couche / note | Poids | Libellé v3 (famille) |
|---|---|---|---|
| `f1` | Qualité NATURE/naturalité — couche 1 (n07) | w_nat (curseur Registre) | Nature sauvage |
| `f2` | Qualité GRANDEUR du paysage — couche 1 (n07) | w_gra | Grands paysages |
| `f3` | Qualité TRANQUILLITÉ/solitude — couche 1 (n07) | w_tra (curseur Foule) | Calme et solitude |
| `f4` | Aptitude/intérêt RANDONNÉE | w_ran (curseur Effort) | Randonnée |
| `f5` | Aptitude BIVOUAC/autonomie | w_biv (curseur Nuit) | Bivouac / autonomie |
| `f6` | **À TRANCHER** : non consommé par `reward_base` (scorie ou 6e critère v3.1) | — | (non mappé) |
| `reward_top8` | Aimant INCONTOURNABLES = Σ 8 meilleurs V_poi atteignables (n05 envie_iconique) | w_inc | Incontournables à portée |
| `hors_foule` | Proxy tranquillité/fréquentation (n07) ; pénalité `anti_foule·(1−hf)` | anti_foule | Loin de la foule |
| `lat_norm` | Latitude normalisée = biais géo NORD (cap nord) | biais_nord | Position nord |
| `cout_moy` | Coût moyen — couche 3 PRIX (n16) ; **Coulisses only** (n20) | SENS_PRIX | (non affiché famille) |
| `th_paysage` | Envie PAYSAGE — couche 2a (n05) | theme_match | Paysages |
| `th_rando` | Envie RANDO — couche 2a (n05) | theme_match | Randonnée (envie) |
| `th_nautique` | Envie NAUTIQUE (n05 kayak/croisière) — **axe dédié** | theme_match | Nautique / eau |
| `th_culturel` | Envie CULTUREL (n05 musées/villages) — **axe dédié** | theme_match | Culture / villages |

## Axes questionnaire (réponse A159 à M491)
- `th_nautique` / `th_culturel` = **axes d'envie DÉDIÉS** (envies distinctes n05).
- `lat_norm` (cap nord) = **biais géographique** (param `biais_nord`), curseur optionnel « aller loin au nord », PAS une envie.
- Les 7 curseurs bipolaires (n04) pilotent les poids : **Registre**→f1-f5, **Foule**→anti_foule/hors_foule+orness, **Nuit**→f5,
  **Effort**→f4, + Rythme/Nouveauté/Tempo (rythme/satiété/marge). Mapping curseur→poids = travail B (M491), formule exacte = v3.1 (M).

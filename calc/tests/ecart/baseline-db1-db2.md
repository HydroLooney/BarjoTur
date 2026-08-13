# Baseline d'écart DB1 ↔ DB2 (snapshot vérifié)

> Preuve que le test d'écart niveau (a) mord cross-DB. Empreintes DB1 (Worker A) et DB2 (Worker B, `SET extra_float_digits=3; datestyle=ISO; timezone=UTC`, identiques). Snapshot 2026-08-13T22:18 (B011). Réf. `run_ecart.py`.

| relation | DB1 lignes | DB1 md5 | DB2 lignes | DB2 md5 | verdict |
|---|--:|---|--:|---|---|
| `mcda2.base_base_routes_v2` | 402 | `ab9046709220` | 401 | `636cc1091907` | **DIVERGE** (attendu) |
| `mcda2.base_base_cost_temps` | 401 | `e35a37641d13` | 401 | `e35a37641d13` | identique |
| `mcda2.poi_f_v2` | 785 | `a0104fe0a3c3` | — | (absente) | **MANQUE en DB2** |
| `mcda2.bases_v2` | 105 | `94dfbf5a3341` | 105 | `94dfbf5a3341` | identique |
| `mcda2.base_reward_inputs` | 105 | `b3194d306c97` | 105 | `b3194d306c97` | identique |

## Lecture

- **Le gate mord sur deux divergences réelles**, sans qu'on ait eu à perturber artificiellement une valeur : (1) `base_base_routes_v2` diffère du seul fait de mon fill ferry 6↔74 (DB2 encore à l'empreinte de départ `636cc1091907`, pré-fill) ; (2) `poi_f_v2` (facteurs) n'est pas encore en DB2. C'est la preuve de non-régression demandée (M004 / gate C17) : un test vert qui devient rouge dès qu'un dérivé diverge.
- **Trois tables déjà alignées** DB1↔DB2 (`base_base_cost_temps`, `bases_v2`, `base_reward_inputs`) : md5 strictement égaux avec les mêmes GUC des deux côtés → l'empreinte est bien déterministe cross-DB (le fix `extra_float_digits=3` tient).
- **DB2 = source synchronisée au pré-fill** : son `base_base_routes_v2` porte `636cc1091907`, exactement mon empreinte AVANT le fill (JOURNAL-repro). La chaîne DB1→DB2 est donc traçable par empreinte.

## Convergence attendue

Quand la matrice A\* complète (Option B) sera livrée en DB1 et intégrée par B en DB2 :
- `base_base_routes_v2` → converge (même empreinte des deux côtés) ;
- `poi_f_v2` → présente et alignée en DB2.

B repassera cette empreinte après intégration (option 2, pont durable) et produira la preuve du gate C16 (`audit_matrice_symetrie.sql` : 0 paire asymétrique, ouest lon<6).

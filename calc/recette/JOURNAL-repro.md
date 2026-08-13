# Journal de reproductibilité du recalcul canonique

> Une ligne par exécution de calcul : date, script, version des sources, empreinte du résultat, note. Append seulement. Preuve de la doctrine A14 (reproductible, traçable).

| Date | Script | Sources (version) | Résultat (table) | Empreinte (md5) | Note |
|---|---|---|---|---|---|
| 2026-08-13 | (audit) `audits/audit_matrice_symetrie.sql` | `mcda2.base_base_routes_v2` @401 | (diagnostic) | base_base_routes_v2 = 636cc1091907 | Référence AVANT recalcul : 401 paires toutes asymétriques, trous 6→74 et 82→77. |
| 2026-08-13 | `patch_ferry_symetrique_corridors.sql` (v1) | `base_base_routes_v2` @401 | `base_base_routes_v2` @403 | 7ab51555756f | Fill miroir 6→74 ET 82→77. **Corrigé ensuite (R1, voir ligne suivante).** |
| 2026-08-13 | REVERT R1 (M009) 82→77 + patch v2 | `base_base_routes_v2` @403 | `base_base_routes_v2` @402 | base_base_routes_v2 = ab9046709220 | **R1 M009** : l'arête routée 77→82 est l'Hardangerfjordekspressen (bateau PASSAGERS Rødne), non van-valide. Mirroir 82→77 retiré (chemin invalide). Ne reste que **6→74** (deux car-ferries réels). Asymétriques 401→**400** (6↔74 comblé ; 82↔77 = trou volontaire, re-route car-ferry Våge–Halhjem requis en 30_matrices). Coût € : 6↔74 = 198 NOK/sens (69+129). |

> Les empreintes sont produites par `calc/tests/ecart/run_ecart.py --db1`. Elles figent l'état de départ ; toute divergence future se lit ici.

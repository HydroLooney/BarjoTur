# Journal de reproductibilité du recalcul canonique

> Une ligne par exécution de calcul : date, script, version des sources, empreinte du résultat, note. Append seulement. Preuve de la doctrine A14 (reproductible, traçable).

| Date | Script | Sources (version) | Résultat (table) | Empreinte (md5) | Note |
|---|---|---|---|---|---|
| 2026-08-13 | (audit) `audits/audit_matrice_symetrie.sql` | `mcda2.base_base_routes_v2` @401 | (diagnostic) | base_base_routes_v2 = 636cc1091907 | Référence AVANT recalcul : 401 paires toutes asymétriques, trous 6→74 et 82→77. |
| 2026-08-13 | `patch_ferry_symetrique_corridors.sql` (v1) | `base_base_routes_v2` @401 | `base_base_routes_v2` @403 | 7ab51555756f | Fill miroir 6→74 ET 82→77. **Corrigé ensuite (R1, voir ligne suivante).** |
| 2026-08-13 | REVERT R1 (M009) 82→77 + patch v2 | `base_base_routes_v2` @403 | `base_base_routes_v2` @402 | base_base_routes_v2 = ab9046709220 | **R1 M009** : l'arête routée 77→82 est l'Hardangerfjordekspressen (bateau PASSAGERS Rødne), non van-valide. Mirroir 82→77 retiré (chemin invalide). Ne reste que **6→74** (deux car-ferries réels). Asymétriques 401→**400** (6↔74 comblé ; 82↔77 = trou volontaire, re-route car-ferry Våge–Halhjem requis en 30_matrices). Coût € : 6↔74 = 198 NOK/sens (69+129). |

| 2026-08-13 | `30_matrices.sql` (agent M, adopté) | ways_van + bases_v2 (105) | `mcda2.matrice_base_base` @11025 | (coût-temps A*) | Matrice A\* complète (pgr_aStarCostMatrix), 0 asymétrique, ouest sain. Fin du KNN. |
| 2026-08-13 | `30b_matrices_km.sql` | ways_van (pgr_dijkstra one-to-many ×105) | `matrice_base_base` (km + split) | (km + roulage/ferry) | km réels + split roulage/ferry par arêtes traversées. 0 négatif (les 4 d'avant = split ferry_leg erroné). 3 min 15. Archive `staging.matrice_base_base_avant_30b`. |
| 2026-08-13 | `01_ferry_cout.sql` + `patch_taux_nok_eur_registre.sql` (A-16) | `composeur_params` (registre) | `ferry_leg` (cout_nok/cout_eur), `composeur_params` (taux) | — | Taux 11.07 NOK/EUR (BCE/Wise 2026-07-15) remonté au registre single-source ; `cout_eur` dérivé du registre (fin du 0.09035 baké). Dédup : mes 2 patches redondants → `.trash/`. |

| 2026-08-13 | A-04 : `ways_van_exclusions` + rebuild 30_matrices/30b avec exclusion | ways_van (moins arête 900000440) | `matrice_base_base` @11025 | md5 = a40a9922b337bc1afd99f9cd20024aed | R1 : 82↔77 routait sur le bateau-PASSAGERS Os-Malkenes (900000440). Exclu ; 82↔77 route par ferry valide 900000436 (35 min, symétrique, 94.3 km). Diagonale rétablie (105). 0 asymétrique, 0 négatif. Dump livré à B (convergence DB2). |

> Les empreintes sont produites par `calc/tests/ecart/run_ecart.py --db1`. Elles figent l'état de départ ; toute divergence future se lit ici.

# DUMP FINAL v3 — 2026-08-17 (M430, bases ré-optimisées N=18)

> Chaîne de finalisation M430 exécutée sur DB1 (base propre post-restart, canonique committé, réversible).
> Gate DB2/flip = **go final Guillaume** (B charge en dry-run owner-safe). R1/R2.

## Fichiers (db/sync/)
| Fichier | Contenu |
|---|---|
| `diffusion-v3-final-20260817.sql` (~36 Mo) | **7 tables** diffusion autoportantes (schéma `diffusion_dump`) |
| `canonique-v3-final-20260817.sql` (~22 Mo) | **canonique v3** : poi.poi, reward_poi, base_reward, bases_ideales, base_node_van, merge_map_v3 |

## Diffusion (7 tables, SRID 4326, index GiST)
| Table | n | Nouveauté v3 |
|---|---|---|
| `v_web_poi` | 767 | tier T-C, confiance, votable, sous_zone_id, categorie_calque |
| `v_web_decoupage` | 173 | 4 Région / 22 District / 147 Paysage + nom_affichage + couverte_par |
| `v_web_poi_services_van` | 1206 | type_nuit / cout_nuit / devise |
| `v_web_routes_sceniques` | 18 | score_interet |
| `v_web_sentiers` | 139241 | difficulté |
| **`v_web_bases_ideales`** | **18** | **bases RÉ-OPTIMISÉES N=18** (rang, source, rayonnement, region_id) |
| **`v_web_poi_photos`** | **685** | manifeste photos (318 POI, 657 vérifiées CC ; clé osm_id + repli poi:) |

## Bases idéales v3 (facility-loc, N=18 validé M430)
- **18 bases** (base_id 1-18 = rang greedy) : **17 van_ok + 1 fondatrice** (ré-optimisation remplace les fondateurs, M370).
- Densité par région : **Vestlandet 8 · Østlandet 5 · Sørlandet 3 · Trøndelag 2**.
- **base_rayonnement** (Σ v_poi atteignable ≤90 min/base) : de Bøla 136,3 (120 POI) à Skarvøy 13,9 (10 POI), moy 41 POI/base.
- **Couverture** (libellé exact, R1, crible M430) : **70/76 sous-zones-avec-POI couvertes** (15 base_interne sur zones-avec-POI
  + 55 base_voisine), **6 non-couvertes = résidu « grande étape de roulage »** (jamais comblé de force). base_interne total = 17
  (dont 2 sur zones sans_poi). 69 sous-zones sans_poi = n/a.

## Empreintes gelées (CORRIGÉES 18/08, M459/A154 — recette CANONIQUE reproductible)
> Correction R1 : les empreintes initiales (`1fae7665`/`7661b1d5`/`1c544690`) provenaient d'une projection AD HOC non
> persistée en script, irréproductible (recherche exhaustive → aucun match). Remplacées par la recette CANONIQUE documentée
> (A078, `empreintes-reference.tsv`), vérifiée indépendamment par M sur DB1 et reproduite par B sur `norvege_stage` (gate
> 0-perte du go-live, triple confirmation à l'octet). Recette : `SET extra_float_digits=3; SELECT md5(string_agg(md5(t.*::text),
> '' ORDER BY <clé>)) FROM (<projection>) t;` (projection excluant les colonnes volatiles geom/jsonb).

| relation | lignes | projection (ordonnée) | ORDER BY | empreinte |
|---|--:|---|---|---|
| `mcda2.reward_poi` | 767 | poi_id, v_poi, tier, tres_frequente | poi_id | `80b6ee34d35ef25a6941b56f5c30168a` |
| `mcda2.base_reward` | 18 | base_id, reward_atteignable, n_poi | base_id | `779e9b4edbe38ad09c3690622961593a` |
| `mcda2.bases_ideales` | 18 | base_id, mclp_rang, structurante, reward, rayonnement, zero_reward | base_id | `deb43d9b375579d8f1cc618a80b4a0e7` |
| `mcda2.reward_poi` (ligne complète) | 767 | toutes colonnes | poi_id | `6fcaa8b51111e07e341011788f179385` |

- matrice reachability `8088e472…` (staging.floc_reach)

## Backups (réversibilité)
`staging.{bases_ideales,base_node_van,base_reward}_backup_pre_v3` (l'état fondateur). Restaurable si besoin.

## Reste coordonné (hors DB1-solo)
- **config.toml Martin prod** (M407) = B.
- **Trous budget RPC** (transit>0 / activités votées → `activites`, anti-double-compte, ravito→repas_courses) : câblage B au
  RPC, spec `docs/design/FRONTIERE-BUDGET-RPC-v3.md`.
- **2e passe services** (laverie/élec fiabilisés + commerces ravito) : attend scrape bobilplass approfondi (staging.bobilplassen_full).
- **Archétypes** : **re-solve LIVE** par le composeur B sur les 18 bases ré-optimisées (les tables v2 `mcda2.archetype_*` sont
  périmées, à ne PAS dumper ; B re-solve).

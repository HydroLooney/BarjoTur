# Inventaire DB1 (`norvege_routing`), vivant

> Généré par `catalogue.sql` puis annoté. Worker A. Mesures directes 2026-08-13 (PostgreSQL 17, Mac local `:5433`, trust). Le canonique cible vs l'éphémère à trasher après gel.

## Vue par schéma (17 schémas métier)

| Schéma | Rôle | Relations | Intermédiaires `_*` | Taille |
|---|---|---|---|---|
| `routing_cont` | graphe transit continu (2,05 M arêtes) | 6 | 0 | 27 Go |
| `routing_car` | graphe voiture (2,05 M) | 9 | 0 | 17 Go |
| `osm` | données OSM brutes | 14 | 0 | 6,6 Go |
| **`mcda2`** | **schéma métier de calcul (cœur Worker A)** | **190** | **99 + 4 backups** | **4,97 Go** |
| `routing` | graphe de base | 10 | 0 | 4,9 Go |
| `routing_pied` | graphe piéton (1,05 M) | 7 | 2 | 1,5 Go |
| `transit` | GTFS (`gtfs_stop_times` 9,37 M) | 6 | 0 | 1,29 Go |
| `norvege_sentiers` | Turrutebasen (`fotrute` 139 311) | 28 | 0 | 689 Mo |
| `diffusion` | couche servie web (`v_web_*`) | 36 | 10 | 552 Mo |
| `pavage` | pavage d'affichage | 1 | 0 | 259 Mo |
| `naturbase` | aires protégées | 1 | 0 | 86 Mo |
| **`poi`** | **POI pivot canonique** | 7 | 0 | 22 Mo |
| `services` | services (carburant, ravito...) | 5 | 2 | 22 Mo |
| `variantes` | variantes d'itinéraire | 8 | 0 | 11 Mo |
| `guide` | catalogue guide (Wemap + PDF) | 6 | 0 | 3,4 Mo |
| `decoupage` | régions / zones | 3 | 0 | 360 Ko |
| `sources` | waypoints CSV sources | 4 | 0 | 240 Ko |

## Objets sources à préserver (jamais recalculés, doctrine #11)

- **`poi.poi`** (1994 lignes, 16 Mo) : POI pivot canonique. Colonnes d'état à préserver : `tier_defaut`, `votable`, `merged_into_poi_id`. Dette : `tier_defaut` NULL = 676 (dont 398 `votable`), cimetière Varhaug ×3 non fusionné (poi_id 139, 141, 272).
- **`poi.rando`** (2816), `poi.circuit`, `poi.troncon`, `poi.route_scenic`, `poi.photo` : expériences sources.
- **`guide.poi`** (backbone 598 POI Wemap + PDF), `guide.poi_texte`, `guide.poi_photo`, `guide.routes_sceniques`, `guide.point_impose` : catalogue guide (scores heuristiques R1).
- **`sources.waypoints_csv`** : waypoints CSV (3 backups datés présents, à sortir hors base).
- **Réseaux bruts** : `routing*`, `osm`, `transit.gtfs_*`, `norvege_sentiers.fotrute`. Bruts, recoûtés en dérivé.
- **Votes et liens perso** : vivent en **DB2** (`decision.vote_*`, `membre.membre`), pas en DB1 (confirmé par B001).

## Objets canoniques cibles (dérivés, recalculés depuis la source)

> Nom cible = convention Q11 (sans `_v2`/`_a0x`). L'existant v2 est la référence de méthode, pas la cible.

### Réseaux et coûts
- `ways_van` (1 016 461 arêtes, 707 Mo) : graphe van recoûté. **READ-ONLY** (exclusions dans une table à part). Cible du patch tunnels (arêtes 6↔74, 82↔77) en amont, via table d'ajouts séparée.
- `pied_cost_tobler` (1 045 553, 95 Mo) : coût marche Tobler sur DTM10.
- `transit_edges` / `transit_node` / `transit_seg` / `transit_transfer` : graphe transit (Entur/GTFS).
- `ferry_edges`, `scenic_edges`, `scenic_troncons` : arêtes ferry et routes scéniques.
- `edge_meas` (1,27 Go), `edge_raw` (125 Mo), `graph` (298 Mo) : mesures d'arêtes (à rationaliser, gros volume).

### Matrices base-à-base (cible = A\* complet, T006)
- `base_base_routes_v2` (401 lignes, 47 Mo) : matrice curée **KNN, TOUTES asymétriques**, 105 bases. `cost_s`, `length_m`, `has_ferry`, `traversee_insulaire`, `geom`. **Cause racine ouest.** Cible : `matrice_base_base` A\* complète et symétrique.
- `base_base_cost_temps` (40 Ko) : coûts APSP sur KNN. **À remplacer** (absorbé dans la matrice cible).
- `base_base_path` (APSP séquence de bases), `base_base_cost`, `base_base_routes` (156 Mo, ancienne) : à consolider.

### Facteurs de qualité (couche 1)
- `poi_f_v2` (785, F1-F8 + f_ville + f_faune) : cible `poi_facteurs`. `f_themes` (non peuplée). `facteurs_densifies` (179 Mo, krigeage par arête).
- `facteurs_v2`, `facteurs_reseau`, `aptitude_reseau`, `owa_audit` : passes d'aptitude successives (10 → 30 → 43) à **consolider en une table** `qualite_poi`.

### Bases et rayonnement
- `bases_v2` (~55 bases van-ok canoniques, table fondatrice) : cible `bases`. `bases_vanok_candidats`, `classement_bases`, `base_rayonnement`, `base_reward_inputs`, `base_value`, `base_services`, `base_activite_supply`.
- `reachability`, `reach_pied`, `reach_web`, `access_walk` (32 Mo) : atteignabilité multimodale (isochrones à recalculer).

### Composeur et archétypes
- `archetype_trip`, `archetype_signature`, `archetypes_routes` (15 Mo), `archetypes_routes_poi` : sorties composeur v2 (recalculées sur moteur refondu).
- `composeur_params`, `aptitude_params` / `aptitude_params_v2` (doublon à fusionner), `poids_reference`, `param_reco`.

### Découpage et diffusion
- `decoupage.regions`, `decoupage.zones`, `decoupage.zones_membres`, `mcda2.sous_zone`, `poi_souszone` : hiérarchie régions/zones (rejouer `poi_souszone` à chaque changement, bug v2).
- `diffusion.v_web_*` (36 relations, 23 vues) : contrat servi web / tuiles. **Vues stables Q11**, le renommage passe derrière.

## Dettes de données (à corriger dans le recalcul, jamais avant gel dictionnaire)

1. **99 tables `_*` + 4 backups dans `mcda2`** (plusieurs centaines de Mo) : intermédiaires à baliser puis déplacer vers `staging` / dumper hors base. Les plus lourdes : `_car_nodes_big` 190 Mo, `_reach_nodes_geom` 172 Mo, `_edge_m32` 135 Mo, triples composantes connexes `_a01_cc`/`_a01_cc_pre`/`_a10_cc` (48 Mo chacune).
2. **Matrice ouest fausse** : 401 paires toutes asymétriques, trous 6→74 et 82→77 (routés ferry au lieu de tunnel). Voir `calc/recette/audits/audit_matrice_symetrie.sql`.
3. **`tier_defaut` NULL = 676** (398 votables) : à renseigner (défauts TSAB reproductibles).
4. **Varhaug ×3** (poi_id 139, 141, 272) : dédup + remap votes.
5. **`public.params_budget`** (61 lignes legacy) : doublon de DB2 `budget.parametre` (single-source). À archiver après gel.
6. **`aptitude_params` vs `aptitude_params_v2`**, `poi_f` vs `poi_f_v2` : versions multiples à consolider.

## À compléter

- Détail colonne par colonne des relations canoniques : sortie de `catalogue.sql` section 3 (à intégrer ici table par table au fil du recalcul, avec provenance et confiance).
- `DB2-inventaire.md` : à co-construire avec B (surface `api.*`, `budget.parametre`, `decision.*`, `membre.*`).

## Livrables Worker A, recalcul canonique + moteur GIS-MCDA (14/08/2026)

Nouvelles tables CANONIQUES `mcda2` (une version par calcul, script rejouable, COMMENT en base, JOURNAL-repro). Toutes recalculées depuis les sources (doctrine plan #11), sources read-only.

| Table canonique | Contenu | Script | Vérif |
|---|---|---|---|
| `matrice_base_base` | Matrice A\* base-à-base (11025, 0 asym), fin du KNN | `30_matrices.sql` + `30b_matrices_km.sql` | gate C16, empreinte a40a9922 |
| `qualite_poi` | Champ qualité OWA (785 POI), WOWA(CRITIC, orness 0,65) | `gis_mcda/f_owa.py` | top-5 cohérent |
| `defaut_poi` | Tier prior (V) + confiance φ (1987) ; tier ⊥ Q | `70_defaut_poi.sql` | 669 neutre B |
| `reward_inputs` | Facteurs reward de nœud (778) ; V_poi non figé (pin M) | `80_reward_inputs.sql` | Bryggen prouvé |
| `poi_decoupage` | Appartenance POI→zone/région rejouable (1987) | `55_poi_decoupage.sql` | 1828 zonés |
| `base_rayonnement` | Qualité réseau atteignable par base (105), anti-MAUP | `50_krigeage_rayonnement.sql` | 16 zéros vérifiés |
| `bases_ideales` | Bases idéales par couverture (60, greedy MCLP + réseau) | `60_bases_ideales.sql` + `60b_*.sql` | corr euclid/réseau 0,887 |
| `ways_van_cout_override` | Recoûtage ferry ≤35km (A-19), COALESCE au rebuild | `32_recout_ferry.sql` | 694 recoûtés |
| `ways_van_exclusions` | Arêtes exclues (45 : 44 artefacts >35km + 1 bateau-passagers) | A-04/A-19 | connectivité 1 composante |

Nouvelles tables de TRAVAIL `_*` (underscore, trashables au ménage A-13 après gel) : `_q_poi_van_node` (snap Q-POI→noeud giant), `_cand_couverture_euclid`, `_cand_poi_w` (relation candidat×POI pour le MCLP).

Dettes résolues depuis le 13/08 : #2 matrice ouest (A\* + gate C16), #3 tier_defaut NULL (→ `defaut_poi`), #4 Varhaug ×3 (dédup soft-merge). Restent M-bound : formule V_poi (A020), gel schéma (A-13), scope bases (A022).

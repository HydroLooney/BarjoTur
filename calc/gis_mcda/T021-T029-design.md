# T021 multimodal + T029 bases routables — conception prête-à-lancer (post-première-bascule)

> Conçu maintenant (M039), exécuté en incrément strangler APRÈS la première bascule. Le van-only suffit au Go Live.
> Ne pas exécuter avant la bascule (cascade base_reward → bases → figés à ne pas rouvrir avant lancement).

## T021 — reward atteignable MULTIMODAL (van → parking → marche + TC)

### Pourquoi
`base_reward` actuel = van-only : Σ V_poi·exp(−coût_van/λ) sur POI ≤3 km d'un nœud van. Il sous-value les POI en
fond de sentier (parking à ≤3 km mais marche réelle non comptée) et les POI accessibles en TC (villes, fjords piétons).

### Infra existante (recompute canonique, pas greenfield)
- Piéton : `mcda2.pied_cost_tobler` (1 045 553 arêtes, coût Tobler pente-dépendant), `_sentiers_m` (100 545),
  `_poi_pied_node`/`_a_poi_pied_node`, `reach_pied`.
- TC : `mcda2.transit_edges` (436 434), `transit_node` (112 271), `transit_seg`, `transit_transfer` (345 968),
  `_transit_aller/retour` (horaires).
- Reach : `reachability`, `reachability_poly`, `_van_reach_m`, `diffusion.v_web_isochrones`.

### Plan de recompute (rejouable, tracé, une version)
1. **Snap POI aux 3 réseaux** : `_q_poi_van_node` (fait) + `_q_poi_pied_node` (nearest nœud pied) + `_q_poi_transit_node`.
2. **Coût d'accès multimodal par POI depuis une base** :
   `coût(base, POI) = min( van_direct, van→parking + pied_tobler(parking, POI), van→halte + TC(halte, halte') + pied(halte', POI) )`.
   - van→parking : matrice base→parkings (isochrone van 10-90 min, cap parking).
   - pied_tobler : `pgr_drivingDistance` sur `pied_cost_tobler` depuis le parking, cap ~20-25 min (M cap marche depuis parking).
   - TC : `pgr_dijkstra` sur `transit_edges` (fenêtres horaires `_transit_aller`), cap ~35 min.
3. **base_reward_multimodal** = Σ V_poi·exp(−coût_multimodal/λ). Remplace base_reward van-only (versionné, non-clobber).
4. **Cascade** : base_reward_multimodal → bases_ideales (re-score) → figés T013 (composeur B). Empreintes + delta.

### Coût / risque
Lourd (isochrones 3 modes × bases + snap × 3). Strangler : s'exécute après la 1re bascule, ne bloque pas le lancement.
Les trailheads restent valorisés en van-only entre-temps (parking ≤3 km). Gain = raffinement fond-de-sentier + TC.

### Params (registre `composeur_params`, à poser à l'exécution)
`pied_cap_min` (marche depuis parking, ~20-25), `tc_cap_min` (~35), `van_iso_min` (10-90), λ par mode.

---

## T029 — bases_ideales → jeu ROUTABLE (post-lancement, esquisse)

### Décision M038 : bases_v2 (104) reste routable, bases_ideales (60) advisory. T029 = si on veut basculer.

### Ce qu'il faudrait
1. Les 60 `bases_ideales` sont des aires `point_id` (bases_vanok_candidats), pas des `base_id` routables.
2. Snap chaque aire idéale à son nœud van (`node_car`/nearest giant) → table `base_ideale_node`.
3. **Rebuild matrice** `pgr_aStarCostMatrix` sur les 60 nœuds (au lieu des 104 bases_v2) → nouvelle `matrice_base_base`
   (espace d'id bases_ideales). Réapplique override recoût + exclusions.
4. **Re-mappe** : reward/rayonnement/reachability sur les 60 ; `archetype_fjords_ouest_seed` recalé.
5. **Convergence** : nouvelle empreinte, dump→B, resync. **Rouvre la convergence** (raison du report post-lancement).

### Pourquoi post-lancement
Gain marginal avant Go Live (bases_v2 atteint déjà l'ouest 12/12, reward valorise l'ouest). Rebâtir sur un autre
espace d'id = coût de convergence non justifié avant la 1re mise en ligne. À faire si l'usage montre que les 104
bases_v2 laissent des trous de couverture que les 60 aires idéales comblent mieux.

---

*Conçu 2026-08-14 (A, M039). Exécution T021 post-1re-bascule ; T029 post-lancement si retenu.*

# DB2 mcda2 — usage par le composeur LIVE (classification read-only, M535)

> Croisement des 43 tables `mcda2` de DB2 (norvege_v2) avec ce que lit le CODE LIVE (sidecar/composeur.py + server). But (M535) :
> documenter la source du live pour **alimenter le rebuild v3.1 + le figement de l'interface**. **DROPS = HOLD après gel v3.1** (crible M
> lot-par-lot, backup ; précieux jamais touchés). « non-lu par sidecar/server » ≠ « droppable » : re-vérifier RPC postgREST / tuiles martin /
> diffusion avant tout drop éventuel.

## CANONIQUE — read-by-live (25, KEEP ; = l'INTERFACE que le rebuild v3.1 doit préserver/remplacer)
`archetype_signature`, `base_activite_candidate`, `base_activite_supply`, `base_base_cost_temps`, `base_base_path`,
`base_node_van`, `base_rayonnement`, `base_reward`, `base_reward_inputs`, `bases_ideales`, `bases_v2`, `leg_astar_cache`,
`matrice_base_base`, `merge_map_v3`, `poi_decoupage`, `reward_poi`, `routing_params`, `sous_zone`,
`ways_van`, `ways_van_exclu`, `ways_van_exclusions`, `ways_pieton`, `ways_rando`.

### ⚠️ PIÈGES (le rebuild v3.1 doit les gérer)
- **`base_base_routes_v2` + `poi_f_v2` : LUES par le live MALGRÉ le nom `_v2`.** Ne PAS les traiter comme scories. Le rebuild
  doit les remplacer proprement derrière l'interface (renommage progressif).
- **`ways_van`/`ways_pieton`/`ways_rando` sont CANONIQUES sur DB2** (le composeur y route en A* live), à l'INVERSE de DB1
  (où `ways_ruteplan` est canonique et `ways_van` = scorie). Le rebuild v3.1 base-à-base sur ways_ruteplan devra fournir DB2 son
  équivalent AVANT de retirer ways_van du live.

## CANDIDATES scorie / non-lu par sidecar-server (18 ; DROP HOLD après gel, re-vérifier RPC/tuiles)
- Backup : `_restos_purged_backup`.
- Intermédiaires graphe : `ways_van_cc`, `ways_van_cc2`, `ways_van_nodes`, `nodes_main`, `clustering_agg`.
- Dérivés non-lus : `base_base_cost`, `base_f_profile`, `base_poi`, `base_value`, `poi_acces`, `poi_tc`, `rando_timing`,
  `archetype_trip`, `emprise_trip`, `frontiere_nord`.
- À VÉRIFIER (config/composer possible) : `composeur_params`, `ferry_leg` (le composer peut les charger autrement que par un FROM direct).

## Suite
Classification = livrée (documentation, alimente rebuild v3.1). Drops = après gel v3.1, crible M lot-par-lot, backup schema-only,
re-vérif RPC/tuiles/diffusion. Précieux (decision/membre/fige/parcours/voyage/reel/budget/intendance) = jamais touchés.

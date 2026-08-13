-- Fix A* live : filtrer mcda2.ways_van_exclusions dans api.route_leg (sinon le van route sur l'arête
-- bateau-passagers Os-Malkenes 900000440 pour 82<->77, R1 M009 / A011). À APPLIQUER APRÈS le restore de A
-- (la table mcda2.ways_van_exclusions vient du dump A-02) et dans la session d'écriture DB2 autorisée.
--
-- AVANT d'appliquer : vérifier le nom de colonne réel de mcda2.ways_van_exclusions (A011 annonce `edge_id`).
--   select column_name from information_schema.columns where table_schema='mcda2' and table_name='ways_van_exclusions';
-- Si ce n'est pas `edge_id`, ajuster la clause ci-dessous.
--
-- Après application : invalider le cache A* live (leg_astar_cache) pour que les legs se recomputent SANS l'arête exclue
-- (sinon la géométrie figée live garde l'ancien tracé fautif).

CREATE OR REPLACE FUNCTION api.route_leg(a integer, b integer)
 RETURNS mcda2.leg_astar_cache
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'mcda2', 'api', 'public', 'pg_temp'
AS $function$
DECLARE na bigint; nb bigint; g geometry; ga geometry; res mcda2.leg_astar_cache;
BEGIN
  SELECT * INTO res FROM mcda2.leg_astar_cache WHERE src_base=a AND tgt_base=b;
  IF FOUND THEN RETURN res; END IF;
  SELECT node_id INTO na FROM mcda2.base_node_van WHERE base_id=a;
  SELECT node_id INTO nb FROM mcda2.base_node_van WHERE base_id=b;
  IF na IS NULL OR nb IS NULL OR na=nb THEN
    INSERT INTO mcda2.leg_astar_cache VALUES(a,b,NULL,0,0,false) ON CONFLICT (src_base,tgt_base) DO NOTHING;
    RETURN (a,b,NULL,0,0,false);
  END IF;
  SELECT ST_LineMerge(ST_Collect(e.geom ORDER BY x.seq)), COALESCE(SUM(e.cost_s),0) INTO g, res.cost_s
  FROM pgr_aStar(
    'SELECT w.id, w.source, w.target, w.cost_s AS cost, w.reverse_cost_s AS reverse_cost,
            COALESCE(w.x1,ST_X(ST_StartPoint(w.geom))) AS x1, COALESCE(w.y1,ST_Y(ST_StartPoint(w.geom))) AS y1,
            COALESCE(w.x2,ST_X(ST_EndPoint(w.geom)))   AS x2, COALESCE(w.y2,ST_Y(ST_EndPoint(w.geom)))   AS y2
     FROM mcda2.ways_van w
     WHERE NOT EXISTS (SELECT 1 FROM mcda2.ways_van_exclu ex WHERE ex.id=w.id)
       AND NOT EXISTS (SELECT 1 FROM mcda2.ways_van_exclusions ex2 WHERE ex2.edge_id=w.id)',
    na, nb, directed:=false) x
  JOIN mcda2.ways_van e ON e.id=x.edge WHERE x.edge <> -1;
  IF g IS NOT NULL AND ST_GeometryType(g)='ST_LineString' THEN
    SELECT geom INTO ga FROM mcda2.bases_v2 WHERE base_id=a;
    IF ST_Distance(ST_StartPoint(g), ga) > ST_Distance(ST_EndPoint(g), ga) THEN g := ST_Reverse(g); END IF;
  ELSIF g IS NOT NULL THEN g := NULL; END IF;
  res := (a, b, g, round((ST_Length(g::geography)/1000)::numeric,1), res.cost_s, (g IS NOT NULL));
  INSERT INTO mcda2.leg_astar_cache VALUES (a,b,g,res.km,res.cost_s,(g IS NOT NULL))
    ON CONFLICT (src_base,tgt_base) DO UPDATE SET geom=EXCLUDED.geom, km=EXCLUDED.km, cost_s=EXCLUDED.cost_s, found=EXCLUDED.found;
  RETURN res;
END $function$;

-- Invalidation du cache live pour recompute propre (legs touchant l'arête exclue ; on vide tout, cache reconstruit à la demande).
TRUNCATE mcda2.leg_astar_cache;

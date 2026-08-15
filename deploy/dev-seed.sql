-- dev-seed.sql (M424/M427) — commodités DEV pour la base norvege_dev UNIQUEMENT (jamais la prod, jamais dans les migrations).
-- 1) Comptes SYNTHÉTIQUES (R2 : PAS les vrais liens famille) pour que C teste l'UX gatée par rôle sans exposer de secret.
-- 2) Stand-in DEV de api.recos_voyageur (la vraie, au flip, dérive du reward mcda2 absent en dev) → l'endpoint /api/recos/:code
--    rend de vrais objets Reco pour valider la couche animée. Marqué DEV : NE PAS jouer en prod.

-- 1) Comptes de test. PIN = '0000' (haché comme api.verifier_pin : salt$sha256hex(pin||salt)). conducteur/rôle variés.
INSERT INTO membre.membre (membre_id, prenom, role, code_lien, pin_hash, actif, conducteur, cree_at) VALUES
  (9001, 'Dev Orga', 'owner',  'DEV-ORG', 'devsalt$'||encode(public.digest('0000'||'devsalt','sha256'),'hex'), true, true,  now()),
  (9002, 'Dev Ado',  'enfant', 'DEV-KID', 'devsalt$'||encode(public.digest('0000'||'devsalt','sha256'),'hex'), true, false, now()),
  (9003, 'Dev Mamie','mamie',  'DEV-MAM', 'devsalt$'||encode(public.digest('0000'||'devsalt','sha256'),'hex'), true, false, now())
ON CONFLICT (membre_id) DO UPDATE SET code_lien=EXCLUDED.code_lien, pin_hash=EXCLUDED.pin_hash, conducteur=EXCLUDED.conducteur;

-- 2) Stand-in DEV de recos_voyageur : top-8 POI votables par score, en objets Reco autoportants (cle/nom/lat/lon/
--    sous_zone_id/tier/rang). La VRAIE (flip) = top-N par valeur/appétit du voyageur (reward mcda2). Ici, indépendant du code.
CREATE OR REPLACE FUNCTION api.recos_voyageur(code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,poi,diffusion,public,pg_temp AS $$
  WITH top AS (
    SELECT p.poi_id, p.osm_id, p.nom, p.tier_defaut, p.geom,
           row_number() OVER (ORDER BY p.score_interet DESC NULLS LAST, p.poi_id) AS rang
    FROM poi.poi p
    WHERE p.votable AND p.geom IS NOT NULL
    ORDER BY p.score_interet DESC NULLS LAST, p.poi_id
    LIMIT 8
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cle', COALESCE(NULLIF(t.osm_id,''), 'poi:'||t.poi_id),
    'nom', t.nom, 'lat', ST_Y(t.geom), 'lon', ST_X(t.geom),
    'sous_zone_id', (SELECT w.sous_zone_id FROM diffusion.v_web_poi w WHERE w.poi_id = t.poi_id),
    'tier', t.tier_defaut, 'rang', t.rang) ORDER BY t.rang), '[]'::jsonb)
  FROM top t;
$$;
GRANT EXECUTE ON FUNCTION api.recos_voyageur(text) TO web_anon;

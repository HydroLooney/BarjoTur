-- db/lib/duree_proposee.sql — fonctions partagées du budget-temps d'activité (A21/M089/M096).
-- CANONIQUE, une seule vérité (B047) : appliqué IDENTIQUE en DB1 (pipeline calc, script 61_) ET en DB2 (RPC
-- api.budget_temps_poi de B, migration 008). Pur, AUCUNE dépendance de données. Schéma neutre `lib` présent dans les deux
-- bases (les deux RPC/requêtes appellent lib.duree_proposee / lib.facteur_avis / lib.facteur_appetit).
-- Idempotent (CREATE OR REPLACE), rollback = DROP des 3 fonctions.

CREATE SCHEMA IF NOT EXISTS lib;

-- Avis agrégé → facteur durée (borné 0,85-1,30).
CREATE OR REPLACE FUNCTION lib.facteur_avis(avis text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE avis
    WHEN 'Coup de cœur' THEN 1.30 WHEN 'Vraiment envie' THEN 1.15
    WHEN 'Bien' THEN 1.00 WHEN 'Pourquoi pas' THEN 0.85 ELSE 1.00 END;
$$;

-- Appétit thématique groupe [0..1] → facteur durée [1,0..1,5].
CREATE OR REPLACE FUNCTION lib.facteur_appetit(appetit numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT 1.0 + 0.5 * greatest(0, least(1, coalesce(appetit,0)));
$$;

-- duree_proposee = clamp(defaut × f_avis × g_appetit, min, max) → arrondi 15 (jamais 30) → palier si granularité ≠ libre.
CREATE OR REPLACE FUNCTION lib.duree_proposee(
  defaut_min numeric, min_min numeric, max_min numeric,
  granularite text, granularites int[], f_avis numeric, g_appetit numeric
) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE brut numeric; clamped numeric; res int; pas int := 15;
BEGIN
  brut := defaut_min * coalesce(f_avis,1.0) * coalesce(g_appetit,1.0);
  clamped := greatest(min_min, least(coalesce(max_min, brut), brut));
  IF granularite = 'libre' OR granularites IS NULL OR array_length(granularites,1) IS NULL THEN
    res := round(clamped/pas) * pas;
  ELSE
    SELECT g INTO res FROM unnest(granularites) g ORDER BY abs(g - clamped) LIMIT 1;
  END IF;
  RETURN greatest(min_min::int, res);
END $$;

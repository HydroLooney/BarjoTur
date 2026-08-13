-- 00_staging.sql, schéma des intermédiaires de calcul (convention Q11, décision Guillaume 2026-08-13).
-- Isole les tables éphémères du canonique : on peut TRUNCATE/DROP en bloc sans risque après recette.
-- Non destructif, rejouable. Aucun objet canonique ici ; les résultats vivent dans mcda2/poi/diffusion.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -f db/schema/00_staging.sql

CREATE SCHEMA IF NOT EXISTS staging;
COMMENT ON SCHEMA staging IS
  'Intermédiaires de calcul BarjoTur (Q11). Remplace le préfixe _ dans mcda2. '
  'Trashables en bloc après gel d''un calcul. Jamais un objet canonique ici.';

-- 82_sentiers_difficulte.sql
-- BarjoTur / Worker A / M225 chantier 3 + M248 (T047) : difficulte des sentiers.
-- R1 : le DEM (DTM10) est ABSENT du disque -> pas de denivele calcule. MAIS la difficulte
--      officielle existe a la SOURCE (Turrutebasen fotruteinfo.gradering, grades G/B/R/S) :
--      source autoritaire, superieure a un proxy denivele. On la recupere via src_objid.
--      1988/2817 restent non gradés (la source ne les grade pas) -> 'non_grade', pas de fabrication.
--      Le denivele D+ reel (pour les non gradés) reste un item Passe 2 SI les dalles DTM10 arrivent.
-- Non destructif : calcul en staging, re-export sentiers.geojson. UPDATE canonique staged pour Passe 2.

DROP TABLE IF EXISTS staging.rando_difficulte;
CREATE TABLE staging.rando_difficulte AS
WITH grade AS (
  SELECT r.rando_id,
    max(CASE upper(coalesce(fi.gradering,''))
          WHEN 'S' THEN 4 WHEN 'R' THEN 3 WHEN 'B' THEN 2 WHEN 'G' THEN 1 ELSE 0 END) sev
  FROM poi.rando r
  JOIN turogfriluftsruter_9fb60114b8f347e69d38b16e28f25d33.fotrute f ON f.objid = r.src_objid
  LEFT JOIN turogfriluftsruter_9fb60114b8f347e69d38b16e28f25d33.fotruteinfo fi ON fi.fotrute_fk = f.objid
  GROUP BY r.rando_id
)
SELECT rando_id,
       CASE sev WHEN 4 THEN 'expert' WHEN 3 THEN 'difficile' WHEN 2 THEN 'moyen'
                WHEN 1 THEN 'facile' ELSE 'non_grade' END AS difficulte,
       sev AS severite
FROM grade;

CREATE INDEX ON staging.rando_difficulte(rando_id);

-- Rebuild calque_sentiers avec la difficulte officielle
DROP VIEW IF EXISTS staging.calque_sentiers;
CREATE VIEW staging.calque_sentiers AS
SELECT
    r.rando_id, r.poi_id, r.nom,
    round(r.longueur_km::numeric, 2)  AS longueur_km,
    d.difficulte,                                   -- grade officiel Turrutebasen (ou 'non_grade')
    NULLIF(r.underlagstype, '')       AS surface,
    NULLIF(r.sesong, '')              AS saison,
    NULLIF(r.merking, '')             AS balisage,
    r.source,
    st_simplifypreservetopology(st_transform(r.geom, 4326), 0.0002) AS geom
FROM poi.rando r
LEFT JOIN staging.rando_difficulte d ON d.rando_id = r.rando_id;

\echo '--- difficulte sentiers (source officielle) ---'
SELECT difficulte, count(*) FROM staging.calque_sentiers GROUP BY 1
ORDER BY CASE difficulte WHEN 'expert' THEN 4 WHEN 'difficile' THEN 3 WHEN 'moyen' THEN 2 WHEN 'facile' THEN 1 ELSE 0 END DESC;

-- ===========================================================================
-- STAGED pour Passe 2 (NE PAS jouer maintenant) : ecrire la difficulte au canonique
-- avec backup. A integrer dans le rejeu Passe 2.
--   CREATE TABLE staging.rando_backup_pre_difficulte AS SELECT * FROM poi.rando;
--   UPDATE poi.rando r SET difficulte = d.difficulte
--     FROM staging.rando_difficulte d WHERE d.rando_id = r.rando_id AND d.severite > 0;
-- ===========================================================================

-- catalogue.sql, générateur du dictionnaire de données DB1
-- Chantier C02 / T003. Rejouable, lecture seule (aucune écriture).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -f db/dictionnaire/catalogue.sql
-- Sort trois sections : inventaire par schéma, relations canoniques, colonnes des relations canoniques.

\pset pager off

\echo '== 1. Inventaire par schéma (tables / matviews / vues / intermédiaires / taille) =='
SELECT n.nspname AS schema,
       count(*) FILTER (WHERE c.relkind = 'r')            AS tables,
       count(*) FILTER (WHERE c.relkind = 'm')            AS matviews,
       count(*) FILTER (WHERE c.relkind = 'v')            AS vues,
       count(*) FILTER (WHERE c.relname LIKE '\_%')       AS intermediaires,
       pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS taille
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm', 'v')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'ogr_system_tables')
GROUP BY n.nspname
ORDER BY sum(pg_total_relation_size(c.oid)) DESC;

\echo ''
\echo '== 2. Relations canoniques (hors intermédiaires _*) des schémas métier =='
SELECT n.nspname || '.' || c.relname          AS relation,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'm' THEN 'matview' WHEN 'v' THEN 'vue' END AS type,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS taille,
       COALESCE(obj_description(c.oid), '')    AS commentaire
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm', 'v')
  AND c.relname NOT LIKE '\_%'
  AND n.nspname IN ('mcda2', 'poi', 'diffusion', 'decoupage', 'guide', 'sources',
                    'routing', 'routing_pied', 'routing_car', 'routing_cont',
                    'transit', 'norvege_sentiers', 'naturbase', 'services', 'variantes')
ORDER BY n.nspname, c.relname;

\echo ''
\echo '== 3. Colonnes des relations canoniques (schémas cœur) =='
SELECT n.nspname || '.' || c.relname       AS relation,
       a.attnum                            AS pos,
       a.attname                           AS colonne,
       format_type(a.atttypid, a.atttypmod) AS type,
       NOT a.attnotnull                    AS nullable,
       COALESCE(col_description(c.oid, a.attnum), '') AS commentaire
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind IN ('r', 'm', 'v')
  AND c.relname NOT LIKE '\_%'
  AND n.nspname IN ('mcda2', 'poi', 'decoupage', 'diffusion')
ORDER BY n.nspname, c.relname, a.attnum;

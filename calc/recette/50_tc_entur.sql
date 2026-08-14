-- 50_tc_entur.sql, accessibilité TC SIMPLIFIÉE depuis Entur GTFS national (M091 item 8).
-- PAS un moteur GTFS : on répond « y a-t-il du TC utile depuis cet arrêt ? » (départs/jour un mercredi type, lignes,
-- 1er/dernier). TC = mode optionnel pour un roadtrip van. On charge stops/routes/trips/calendar/stop_times (PAS shapes 2,7 Go).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/50_tc_entur.sql
\set ON_ERROR_STOP on
\set D /Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs

DROP TABLE IF EXISTS staging.gtfs_stops, staging.gtfs_routes, staging.gtfs_trips, staging.gtfs_calendar, staging.gtfs_stop_times CASCADE;
CREATE TABLE staging.gtfs_stops(stop_id text, stop_name text, stop_lat float8, stop_lon float8, stop_desc text, location_type text, parent_station text, wheelchair_boarding text, stop_timezone text, vehicle_type text, platform_code text);
CREATE TABLE staging.gtfs_routes(agency_id text, route_id text, route_short_name text, route_long_name text, route_type int, route_desc text, route_url text, route_color text, route_text_color text);
CREATE TABLE staging.gtfs_trips(route_id text, trip_id text, service_id text, trip_headsign text, direction_id text, shape_id text, wheelchair_accessible text);
CREATE TABLE staging.gtfs_calendar(service_id text, monday int, tuesday int, wednesday int, thursday int, friday int, saturday int, sunday int, start_date text, end_date text);
CREATE TABLE staging.gtfs_stop_times(trip_id text, stop_id text, arrival_time text, departure_time text, stop_sequence int, stop_headsign text, pickup_type text, drop_off_type text, shape_dist_traveled text);

\copy staging.gtfs_stops FROM '/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs/stops.txt' CSV HEADER
\copy staging.gtfs_routes FROM '/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs/routes.txt' CSV HEADER
\copy staging.gtfs_trips FROM '/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs/trips.txt' CSV HEADER
\copy staging.gtfs_calendar FROM '/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs/calendar.txt' CSV HEADER
\copy staging.gtfs_stop_times FROM '/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur/data/source/reseau/entur-gtfs/stop_times.txt' CSV HEADER

CREATE INDEX ON staging.gtfs_stop_times(stop_id);
CREATE INDEX ON staging.gtfs_stop_times(trip_id);
CREATE INDEX ON staging.gtfs_trips(trip_id);
CREATE INDEX ON staging.gtfs_trips(service_id);
CREATE INDEX ON staging.gtfs_stops(stop_id);

-- Services actifs un mercredi type.
DROP TABLE IF EXISTS staging.gtfs_service_wed;
CREATE TABLE staging.gtfs_service_wed AS SELECT service_id FROM staging.gtfs_calendar WHERE wednesday=1;
CREATE INDEX ON staging.gtfs_service_wed(service_id);

-- Accessibilité par arrêt : départs mercredi, lignes distinctes, 1er/dernier, type véhicule.
DROP TABLE IF EXISTS mcda2.tc_arret_acces;
CREATE TABLE mcda2.tc_arret_acces AS
SELECT s.stop_id, s.stop_name,
  ST_SetSRID(ST_MakePoint(s.stop_lon, s.stop_lat),4326) AS geom,
  count(*) AS departs_mer,
  count(DISTINCT tr.route_id) AS n_lignes,
  min(st.departure_time) AS premier, max(st.departure_time) AS dernier
FROM staging.gtfs_stop_times st
JOIN staging.gtfs_trips tr ON tr.trip_id = st.trip_id
JOIN staging.gtfs_service_wed w ON w.service_id = tr.service_id
JOIN staging.gtfs_stops s ON s.stop_id = st.stop_id
WHERE s.stop_lat IS NOT NULL AND coalesce(st.pickup_type,'0') <> '1'   -- exclut les arrêts descente-seule
GROUP BY s.stop_id, s.stop_name, s.stop_lon, s.stop_lat;
CREATE INDEX ON mcda2.tc_arret_acces USING gist(geom);
CREATE INDEX ON mcda2.tc_arret_acces(stop_id);
COMMENT ON TABLE mcda2.tc_arret_acces IS 'Accessibilité TC simplifiée (Entur GTFS, 14/08) : départs un mercredi type + lignes + amplitude par arrêt. Pas un routeur GTFS. Script 50_.';

\echo '== volumétrie GTFS chargée =='
SELECT (SELECT count(*) FROM staging.gtfs_stops) stops, (SELECT count(*) FROM staging.gtfs_stop_times) stop_times, (SELECT count(*) FROM staging.gtfs_trips) trips;
\echo '== arrêts avec service mercredi + distribution départs =='
SELECT count(*) arrets_actifs, round(avg(departs_mer)::numeric,1) departs_moy, max(departs_mer) departs_max,
       count(*) FILTER (WHERE departs_mer>=20) arrets_frequents FROM mcda2.tc_arret_acces;
\echo '== bases avec un arrêt TC fréquent (>=20 départs) a <2 km =='
SELECT count(*) FILTER (WHERE EXISTS (
  SELECT 1 FROM mcda2.tc_arret_acces a WHERE a.departs_mer>=20 AND ST_DWithin(a.geom::geography, b.geom::geography, 2000)
)) bases_tc, count(*) total FROM mcda2.bases_v2 b;

-- 022_reservations_lire_rpc.sql (M547 / #3 budget vivant) — expose prepa.reservation au BFF via une RPC api.* en
-- SECURITY DEFINER. Le rôle du BFF n'a pas USAGE sur le schéma `prepa` (permission denied for schema prepa) ; la RPC
-- s'exécute comme son PROPRIÉTAIRE (qui lit prepa), sans changer les droits du rôle applicatif. Lecture seule.
--
-- SURFACE : DB2, schéma applicatif `api` (surface B, M525). Additif (CREATE OR REPLACE). Ne touche AUCUNE donnée (SELECT).
-- GATE : dry-run BEGIN…ROLLBACK puis APPLY (app-schema RPC, non précieux). Rollback = DROP FUNCTION api.reservations_lire().
-- Usage : cat db/migrations/022_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION api.reservations_lire()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,prepa,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'type', type,
    'libelle', libelle,
    'date_arr', to_char(date_arr, 'YYYY-MM-DD'),
    'statut', statut,
    'montant', montant,
    'devise', devise,
    'note', note
  ) ORDER BY date_arr NULLS LAST, id), '[]'::jsonb)
  FROM prepa.reservation;
$$;
COMMENT ON FUNCTION api.reservations_lire() IS 'M547/#3 budget vivant : réservations réelles (prepa.reservation) pour le BFF. SECURITY DEFINER (contourne les perms de schéma du rôle applicatif). Lecture seule.';

COMMIT;

-- ACCEPTATION (dry-run) : SELECT jsonb_array_length(api.reservations_lire());  -- nombre de réservations, ou 0 (jamais NULL)
-- Rollback : DROP FUNCTION api.reservations_lire();

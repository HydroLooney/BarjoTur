import type { EtapeFige } from '@barjotur/shared';

// Étapes de démonstration pour le FIL d'itinéraire (A32 / M155). Choisies pour montrer l'HYBRIDE séjour/jour :
// deux séjours de plusieurs jours au même camp de base (dépliables en journées) + un séjour d'un jour. Valeurs
// illustratives (R1) ; au flip, les vraies étapes viennent du figé. Distinct de `figeDetailDemo` (qui, lui, a un
// camp de base différent par jour, pour l'Atlas).
function jour(p: {
  jour: number;
  date: string;
  base_id: number;
  camp: string;
  nuitee: string;
}): EtapeFige {
  return {
    fige_id: 1,
    jour: p.jour,
    aire_lat: null,
    aire_lon: null,
    stop_id: null,
    nuitee_type: p.nuitee,
    poi_osm_ids: null,
    tier_jour: null,
    roulage_min: null,
    meteo_dependant: null,
    repli: null,
    note: null,
    date_jour: p.date,
    base_id: p.base_id,
    lever: null,
    coucher: null,
    circuit: null,
    resume_jour: { camp_base: p.camp },
  };
}

export const etapesFilDemo: EtapeFige[] = [
  jour({ jour: 1, date: '2027-08-05', base_id: 1, camp: 'Kristiansand', nuitee: 'autonomie' }),
  jour({ jour: 2, date: '2027-08-06', base_id: 1, camp: 'Kristiansand', nuitee: 'autonomie' }),
  jour({ jour: 3, date: '2027-08-07', base_id: 2, camp: 'Stavanger', nuitee: 'payant' }),
  jour({ jour: 4, date: '2027-08-08', base_id: 2, camp: 'Stavanger', nuitee: 'autonomie' }),
  jour({ jour: 5, date: '2027-08-09', base_id: 3, camp: 'Bergen', nuitee: 'autonomie' }),
];

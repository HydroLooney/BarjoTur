import type { MultiLineString } from 'geojson';
import type { EtapeFige, FigeDetail, ItineraireFige, ResumeJour, ScenarioDefaut } from '@barjotur/shared';

// Fixture de DEV UNIQUEMENT (chargee dynamiquement sous import.meta.env.DEV, jamais en prod), pour la
// verif visuelle du rendu de la carte animee sans le BFF : un trace cotier ouest-norvegien plausible en
// DEUX troncons routes separes par une TRAVERSEE d'eau (grand saut) qui doit se rendre TIRETEE. Ce n'est
// PAS le consensus reel (fige 141) : la verif end-to-end sur donnee reelle reste le volet live du gate C16.
export const figeGeomDemo: MultiLineString = {
  type: 'MultiLineString',
  coordinates: [
    // Troncon 1 : Kristiansand -> Stavanger -> Haugesund (route cotiere).
    [
      [8.0, 58.15],
      [7.2, 58.35],
      [6.6, 58.9],
      [5.9, 58.9],
      [5.5, 59.2],
      [5.3, 59.41],
    ],
    // Troncon 2 : apres une traversee (ferry) vers Bergen, puis remontee des fjords jusqu'a l'APEX (Flam).
    [
      [6.15, 60.39],
      [6.6, 60.55],
      [7.2, 60.7],
      [7.9, 61.1],
      [8.5, 61.5],
    ],
    // Troncon 3 : RETOUR vers Kristiansand par l'INTERIEUR (est, distinct de la cote de l'aller) pour reprendre
    // le ferry. Rend l'aller/retour lisible sur la carte animee (sous-brique 3) ; le vrai voyage boucle ainsi.
    [
      [8.5, 61.5],
      [8.7, 60.6],
      [9.0, 59.7],
      [8.7, 59.0],
      [8.3, 58.5],
      [8.0, 58.15],
    ],
  ],
};

// --- Atlas de démonstration (M103) : 4 jours à la forme de `FigeDetail`, pour bâtir le voyage-papier sur
// fixture (non gaté). resume_jour = INTERPRÉTATION front illustrative (R1), remplacée par le jsonb réel de B au
// flip. Km/ferry/budget par jour = illustratifs (ils viendront de la compo + budget-jour de B).
function etapeDemo(p: Partial<EtapeFige> & { jour: number; resume: ResumeJour }): EtapeFige {
  return {
    fige_id: 1,
    jour: p.jour,
    aire_lat: p.aire_lat ?? null,
    aire_lon: p.aire_lon ?? null,
    stop_id: null,
    nuitee_type: p.nuitee_type ?? null,
    poi_osm_ids: p.poi_osm_ids ?? null,
    tier_jour: p.tier_jour ?? null,
    roulage_min: p.roulage_min ?? null,
    meteo_dependant: p.meteo_dependant ?? null,
    repli: null,
    note: p.note ?? null,
    date_jour: p.date_jour ?? null,
    base_id: p.base_id ?? null,
    lever: p.lever ?? null,
    coucher: p.coucher ?? null,
    circuit: null,
    resume_jour: p.resume,
  };
}

const etapesDemo: EtapeFige[] = [
  etapeDemo({
    jour: 1,
    date_jour: '2027-08-05',
    base_id: 1,
    nuitee_type: 'autonomie',
    roulage_min: 90,
    lever: '07:30',
    coucher: '22:15',
    poi_osm_ids: ['p1', 'p2'],
    note: "Arrivée du ferry, première nuit au calme près de la côte.",
    resume: {
      camp_base: 'Kristiansand',
      km: 70,
      budget_eur: 95,
      lieux: [
        { nom: 'Vieille ville de Kristiansand', temps_min: 90 },
        { nom: 'Plage de Bystranda', temps_min: 60 },
      ],
    },
  }),
  etapeDemo({
    jour: 2,
    date_jour: '2027-08-06',
    base_id: 2,
    nuitee_type: 'autonomie',
    roulage_min: 150,
    lever: '06:45',
    coucher: '22:30',
    poi_osm_ids: ['p3'],
    note: 'Journée rando : le Preikestolen, départ tôt pour éviter la foule.',
    resume: {
      camp_base: 'Stavanger',
      km: 190,
      traversees: 1,
      ferry_min: 40,
      ferry_eur: 30,
      budget_eur: 140,
      lieux: [{ nom: 'Preikestolen (rando)', temps_min: 300 }],
    },
  }),
  etapeDemo({
    jour: 3,
    date_jour: '2027-08-07',
    base_id: 3,
    nuitee_type: 'payant',
    roulage_min: 210,
    lever: '07:15',
    coucher: '23:00',
    poi_osm_ids: ['p4', 'p5'],
    note: 'Remontée vers les fjords, nuit en camping pour recharger.',
    resume: {
      camp_base: 'Bergen',
      km: 230,
      traversees: 2,
      ferry_min: 75,
      ferry_eur: 55,
      budget_eur: 175,
      lieux: [
        { nom: 'Bryggen (quartier hanséatique)', temps_min: 120 },
        { nom: 'Mont Fløyen', temps_min: 90 },
      ],
    },
  }),
  etapeDemo({
    jour: 4,
    date_jour: '2027-08-08',
    base_id: 4,
    nuitee_type: 'autonomie',
    roulage_min: 120,
    lever: '07:00',
    coucher: '22:00',
    poi_osm_ids: ['p6'],
    note: 'Flåm et son train panoramique, flânerie au bord du fjord.',
    resume: {
      camp_base: 'Flåm',
      km: 150,
      budget_eur: 120,
      lieux: [{ nom: 'Train de Flåm', temps_min: 120 }],
    },
  }),
];

const itineraireDemo: ItineraireFige = {
  fige_id: 1,
  code: null,
  label: 'Voyage de démonstration',
  fige_at: null,
  km: 1850,
  temps_min: 2400,
  denivele_pos_m: null,
  nuits: 4,
  ferry_interieur_eur: 85,
  famille: null,
  archetype_key: null,
  est_archetype: false,
  fiche: null,
  retenu: true,
  calcule_db1: false,
  est_consensus: true,
  membre_id: null,
};

/** `FigeDetail` de démonstration pour l'Atlas hors live (M103). Géométrie = le tracé démo à deux tronçons. */
export const figeDetailDemo: FigeDetail = {
  itineraire: itineraireDemo,
  geom: figeGeomDemo as unknown as FigeDetail['geom'],
  etapes: etapesDemo,
  waypoints: [],
};

/** Scénario par défaut de démonstration (pointe vers l'atlas démo). */
export const scenarioDemo: ScenarioDefaut = {
  fige_id: 1,
  source: 'consensus',
  label: 'Voyage de démonstration',
  km: 1850,
  nuits: 4,
};

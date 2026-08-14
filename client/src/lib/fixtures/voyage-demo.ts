import type { EtapeTransit, Voyage } from '@barjotur/shared';

// Fixture flip-ready de l'instance voyage + transit (A19 / M055). Forme EXACTE des contrats shared, pour
// bâtir et vérifier l'app-side du transit avant le routage réel (corridor A) et l'optim transit (sidecar B).
// Domicile = départ = arrivée (A/R bouclé). Le faisceau = candidats, pas des POI imposés (l'optim choisit).
const DOMICILE = { label: '12 Coteau de la Pinède, 67590 Schweighouse-sur-Moder', lat: 48.821, lon: 7.777 };
const PORT_HIRTSHALS = { label: 'Hirtshals (port ferry)', lat: 57.594, lon: 9.958 };

export const voyageDemo: Voyage = {
  voyage_id: 1,
  titre: 'Norvège 2027',
  point_depart: DOMICILE,
  point_arrivee: DOMICILE,
};

// Deux étapes de transit : l'aller (domicile → port ferry, sous jalon de date ferry) et le retour.
export const transitDemo: EtapeTransit[] = [
  {
    id: 't-aller',
    ordre: 1,
    depuis: DOMICILE,
    vers: PORT_HIRTSHALS,
    jalon_date: '2027-08-03',
    faisceau: [
      { id: 'a-hambourg', label: 'Hambourg', lat: 53.55, lon: 10.0, epingle: false, reserve: false, autonomie: true },
      { id: 'a-kolding', label: 'Kolding (DK)', lat: 55.49, lon: 9.47, epingle: true, reserve: true, autonomie: false },
    ],
  },
  {
    id: 't-retour',
    ordre: 2,
    depuis: PORT_HIRTSHALS,
    vers: DOMICILE,
    jalon_date: null,
    faisceau: [
      { id: 'r-brême', label: 'Brême', lat: 53.08, lon: 8.8, epingle: false, reserve: false, autonomie: true },
    ],
  },
];

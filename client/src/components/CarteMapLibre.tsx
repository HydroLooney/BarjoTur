import type { Geometry } from 'geojson';
import type { EtapeEntree } from '@/lib/anim-trajet';
import { CarteExplorer } from '@/components/CarteExplorer';
import { CarteItineraire } from '@/components/CarteItineraire';
import { CarteCoulisses } from '@/components/CarteCoulisses';
import { MiniCarteRando } from '@/components/MiniCarteRando';

// CarteMapLibre (T051) : POINT D'ENTRÉE UNIQUE de la carto (SPEC-CONSOLIDEE / M181-C9). Les trois usages carto
// se demandent maintenant par un `mode`, au-dessus du SEUL monteur du <Map> (CadreCarte, un contexte WebGL, A05).
// On ne fusionne PAS les trois rendus dans un seul corps (un composant a rallonge nuirait a la maintenance, but
// contraire de M181) : chaque mode garde son rendu FOCALISE et testable, et ce dispatcher tient le contrat commun
// (fond, dimensions, montage partages via CadreCarte). C'est l'unification demandee : une API, un montage, trois modes.
//  - `exploration`   : decouverte interactive de tous les POI de l'emprise + sentiers (vote au clic).
//  - `lecture`        : trace STATIQUE d'un circuit (apercu rando, vue Vitrine en lecture seule).
//  - `lecture-ideal`  : itineraire IDEAL anime (reveal du fige.geom au prorata du temps).
//  - `coulisses`      : carte de diagnostic backstage (decoupage region/zone/sous-zone + bases ideales, T069).

export type ModeCarte = 'exploration' | 'lecture' | 'lecture-ideal' | 'coulisses';

type Props =
  | { mode: 'exploration'; hauteur?: string }
  | { mode: 'lecture'; geom: Geometry; hauteur?: string }
  | { mode: 'lecture-ideal'; geom: Geometry | null; etapes?: EtapeEntree[]; hauteur?: string }
  | { mode: 'coulisses'; hauteur?: string };

export function CarteMapLibre(props: Props) {
  switch (props.mode) {
    case 'exploration':
      return <CarteExplorer hauteur={props.hauteur} />;
    case 'lecture':
      return <MiniCarteRando geom={props.geom} hauteur={props.hauteur} />;
    case 'lecture-ideal':
      return <CarteItineraire geom={props.geom} etapes={props.etapes} hauteur={props.hauteur} />;
    case 'coulisses':
      return <CarteCoulisses hauteur={props.hauteur} />;
  }
}

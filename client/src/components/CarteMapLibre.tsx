import type { Geometry } from 'geojson';
import type { EtapeEntree } from '@/lib/anim-trajet';
import type { BBox } from '@/lib/queries/poi-bbox';
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

/** Cible de recentrage caméra partagée (clic d'un lieu / d'une puce jour). */
export interface CibleCamera {
  lon: number;
  lat: number;
  zoom?: number;
}

type Props =
  | {
      mode: 'exploration';
      hauteur?: string;
      /** Recentre la carte sur un point (clic d'un lieu depuis un panneau) — sans quitter la carte (M505 §3). */
      centrer?: CibleCamera | null;
      /** Remonte l'emprise visible pour piloter la liste par la vue (M505 §2b). */
      onBbox?: (bbox: BBox) => void;
    }
  | { mode: 'lecture'; geom: Geometry; hauteur?: string }
  | {
      mode: 'lecture-ideal';
      geom: Geometry | null;
      etapes?: EtapeEntree[];
      hauteur?: string;
      /** Recentre sur l'étape au clic d'une puce jour (barre d'animation, M499/M502). */
      centrer?: CibleCamera | null;
    }
  | { mode: 'coulisses'; hauteur?: string };

export function CarteMapLibre(props: Props) {
  switch (props.mode) {
    case 'exploration':
      return <CarteExplorer hauteur={props.hauteur} centrer={props.centrer ?? null} onBbox={props.onBbox} />;
    case 'lecture':
      return <MiniCarteRando geom={props.geom} hauteur={props.hauteur} />;
    case 'lecture-ideal':
      return <CarteItineraire geom={props.geom} etapes={props.etapes} hauteur={props.hauteur} centrer={props.centrer ?? null} />;
    case 'coulisses':
      return <CarteCoulisses hauteur={props.hauteur} />;
  }
}

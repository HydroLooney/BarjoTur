// Itinéraire MIXTE du composeur (C06/A04, M059) : un voyage est une suite d'étapes TYPÉES — expérience
// (orienteering, on maximise le beau) et transit (repositionnement, on minimise + faisceau, A19). L'orchestration
// (séquencer, dispatcher par mode, poser les arrêts imposés) est non-routable ; l'optim transit attend le corridor d'A.
//
// Types locaux au BFF (DTO d'orchestration) : la structure des étapes vit dans @barjotur/shared (voyage.ts), on
// compose au-dessus. À canoniser dans shared si le front en a besoin (signalé à M).

import type { ComposeInput, ComposeReponse } from './composeur.js';
import type { ArretTransit, EtapeTransit, NatureEtape } from './voyage.js';

/** Une étape de l'itinéraire mixte : soit une expérience (entrée composeur), soit un transit (faisceau + jalon). */
export type EtapeItineraire =
  | { nature: 'experience'; experience: ComposeInput }
  | { nature: 'transit'; transit: EtapeTransit };

/** Résultat d'une étape routée. L'expérience porte la réponse composeur ; le transit porte ses arrêts imposés et son
 *  statut (routé plus tard, au corridor). */
export interface EtapeRoutee {
  ordre: number;
  nature: NatureEtape;
  /** Réponse du composeur pour une étape expérience (orienteering). */
  experience?: ComposeReponse;
  /** Étape transit préparée : arrêts imposés (contrainte dure) + statut de routage. */
  transit?: {
    etape: EtapeTransit;
    arrets_imposes: ArretTransit[];
    statut: 'en_attente_corridor';
  };
}

/** L'itinéraire mixte orchestré : les étapes routées, dans l'ordre, + le compte des transits en attente du corridor. */
export interface ItineraireOrchestre {
  ok: boolean;
  etapes: EtapeRoutee[];
  transit_en_attente: number;
}

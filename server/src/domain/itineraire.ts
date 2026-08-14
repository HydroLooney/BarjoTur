// Itinéraire MIXTE du composeur (C06/A04, M059) : un voyage est une suite d'étapes TYPÉES — expérience
// (orienteering, on maximise le beau) et transit (repositionnement, on minimise + faisceau, A19). L'orchestration
// (séquencer, dispatcher par mode, poser les arrêts imposés) est non-routable ; l'optim transit attend le corridor d'A.
//
// `EtapeRoutee` est CANONIQUE dans @barjotur/shared (composeur.ts, M062) : on la réexporte, pour que l'orchestration
// et `ComposeReponse.etapes` partagent exactement la même forme. `EtapeItineraire` (entrée d'orchestration) reste local.

import type { ComposeInput } from './composeur.js';
import type { EtapeTransit } from './voyage.js';

export type { EtapeRoutee } from '@barjotur/shared';

/** Une étape de l'itinéraire mixte à orchestrer : soit une expérience (entrée composeur), soit un transit (faisceau). */
export type EtapeItineraire =
  | { nature: 'experience'; experience: ComposeInput }
  | { nature: 'transit'; transit: EtapeTransit };

/** L'itinéraire mixte orchestré : les étapes routées (forme partagée), dans l'ordre, + le compte des transits en
 *  attente du corridor. `etapes` est du type partagé `EtapeRoutee[]`, identique à `ComposeReponse.etapes`. */
export interface ItineraireOrchestre {
  ok: boolean;
  etapes: import('@barjotur/shared').EtapeRoutee[];
  transit_en_attente: number;
}

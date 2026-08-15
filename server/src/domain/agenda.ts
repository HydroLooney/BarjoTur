// Contrats agenda : CANONIQUES dans @barjotur/shared (posés par M, cafb053, M527). Re-export + forme BRUTE du sidecar.
// L'endpoint #4 mappe la sortie build_agenda (dicts bruts, typés localement) vers AgendaVoyage. Champs non calculés = null (R1).

export type {
  AgendaVoyage,
  JourAgenda,
  ActiviteAgenda,
  ConfortJour,
  GroupeMoment,
  ContrainteHoraire,
  TypeNuit,
  DensiteJour,
} from '@barjotur/shared';

/**
 * Forme BRUTE d'une étape d'agenda telle que le sidecar la renvoie (build_agenda). Le type partagé ComposeReponse.etapes
 * (EtapeRoutee géom/transit) ne décrit PAS cette sortie agenda : on la type ici pour un mapping sûr, sans y toucher.
 */
export interface SegmentBrut {
  ordre?: number;
  mode?: string;
  type?: string;
  ref?: unknown;
  heure_debut?: string;
  duree_min?: number;
  note?: string;
}
export interface CircuitBrut {
  nom?: string;
  segments?: SegmentBrut[];
  tsab?: unknown;
}
export interface ResumeJourBrut {
  activites?: string[];
  picnic?: boolean;
  n_activites?: number;
  tsab_jour?: unknown;
  circuit_nom?: string;
  climax?: boolean;
  note?: string;
}
export interface EtapeAgendaBrute {
  jour?: number;
  date?: string;
  base_id?: number;
  nuitee_type?: string;
  lever?: string;
  coucher?: string;
  circuit?: CircuitBrut;
  resume_jour?: ResumeJourBrut;
}

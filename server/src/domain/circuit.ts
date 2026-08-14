// Circuits tout-faits des guides + activité idéale par zone (A23) — contrats canoniques dans @barjotur/shared
// (circuit.ts, posé par M, c56b1da). Re-export. Objets issus des GUIDES (haute vérité, R1), en LECTURE seule côté app
// (les voyageurs ne les écrivent pas) ; les données réelles viennent d'A (tables circuit / zone_activite_ideale).

export type {
  Circuit,
  EtapeCircuit,
  ModeCircuit,
  DureeCircuit,
  SourceGuide,
  ZoneActiviteIdeale,
} from '@barjotur/shared';

// Instance voyage (A19 §9, M055) : origine/destination + étapes typées expérience/transit. La STRUCTURE est canonique
// dans @barjotur/shared (voyage.ts) : on la réexporte. Norvège 2027 n'est QU'UNE instance ; aucun voyage codé en dur
// (multi-voyage-ready, A18 §7.3). Le routage réel du corridor et l'optimisation transit sont côté calcul/sidecar.

export type {
  PointVoyage,
  NatureEtape,
  Voyage,
  ArretTransit,
  EtapeTransit,
} from '@barjotur/shared';

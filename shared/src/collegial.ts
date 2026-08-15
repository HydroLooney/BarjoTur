// Contrat de l'ANALYSE COLLÉGIALE (P0 #5), posé par M. Le « radar du nous » + la contribution par personne : comment le
// voyage commun agrège les profils de la famille (LEXIMIN, le moins servi d'abord), et ce que chacun y a pesé. Additif.
// Réf. ROLES-DISTRIBUTION promesse #4 (leximin) + gis-mcda/15 (consensus égalitariste). Vocabulaire MCDA v3 (note 04/05).

/** Un axe du radar (curseur note 04 ou envie note 05) : la valeur du « nous » agrégée + chaque personne. */
export interface AxeRadar {
  cle: string;
  libelle: string;
  /** Valeur agrégée de la famille sur cet axe, [0..1]. */
  nous: number;
  /** La valeur de chaque voyageur sur cet axe, pour lire l'écart. */
  par_personne: { voyageur_id: number; prenom: string; valeur: number }[];
}

/** La contribution d'un voyageur au voyage commun (satisfaction leximin + poids réel). */
export interface ContributionPersonne {
  voyageur_id: number;
  prenom: string;
  /** Satisfaction scalaire du voyageur pour le voyage retenu, [0..1] (leximin : on maximise d'abord le min). */
  satisfaction: number;
  /** Le voyageur est-il, sur ce voyage, le « moins servi » que le leximin a protégé en priorité ? */
  est_moins_servi: boolean;
  /** Part de ses coups de cœur / votes effectivement honorés dans le voyage retenu, [0..1]. */
  souhaits_honores: number;
}

/** L'analyse collégiale du voyage retenu : radar du « nous » + contribution par personne + la méthode d'agrégation. */
export interface AnalyseCollegiale {
  axes: AxeRadar[];
  contributions: ContributionPersonne[];
  /** L'agrégation employée (leximin égalitaire, cohérent gis-mcda/15). */
  methode: 'leximin';
  /** Satisfaction du voyageur le moins servi (la garantie leximin), [0..1]. */
  satisfaction_min: number;
  /** Une phrase de synthèse honnête (R1), ex. « un voyage qui protège d'abord le moins servi ». */
  synthese?: string | null;
}

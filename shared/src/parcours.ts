// Contrat du cycle de vie du voyage (A18) : la machine à crans et les états de validation.
// STRUCTURE stable ; la POLITIQUE (quel cran gèle quels profils/params, réversibilité) est de la config/donnée,
// différée aux arbitrages de Guillaume (A18 §6). On type la machinerie, pas les règles métier figées.

/** État de validation d'un cran, visible à l'utilisateur (A18 §3). */
export type EtatValidation =
  | 'brouillon'            // en cours, rien de figé
  | 'valide_modifiable'    // franchi mais rouvrable (cadenas ouvert), au prix d'un recompute de l'aval
  | 'valide_verrouille';   // figé par un fait extérieur (réservation, paiement) — cadenas fermé

/** Identité d'un cran du parcours. Liste = donnée (config), pas figée au type ; ces valeurs sont l'esquisse A18 §2. */
export type CranId =
  | 'cadrage'
  | 'reservation_van'
  | 'exploration'
  | 'composition'
  | 'logistique'
  | 'depart';

/** Un cran du parcours (étape à franchir). */
export interface Cran {
  id: CranId;
  libelle: string;
  ordre: number;
  etat: EtatValidation;
  /** Profils/params que ce cran fige à sa validation (ex. le profil van au cran reservation_van). Politique = config. */
  gele: string[];
  /** Rouvrable par l'organisateur ? false = verrouillage définitif (ex. paiement). Politique = config (A18 §6 Q2). */
  reouvrable: boolean;
  valide_at: string | null;
  valide_par: number | null;
}

/** L'état d'avancement d'un voyage : la machine à crans (A18). */
export interface EtatParcours {
  voyage_id: number;
  crans: Cran[];
  /** Le cran actif (premier non validé, ou le dernier rouvert). */
  cran_courant: CranId;
}

/** Demande de transition d'un cran (franchir, verrouiller, rouvrir). Gardée par le rôle (organisateur). */
export type ActionCran = 'valider' | 'verrouiller' | 'rouvrir';

export interface TransitionCran {
  voyage_id: number;
  cran: CranId;
  action: ActionCran;
  /**
   * Code PIN de l'organisateur. Requis pour une transition d'un cran MODIFIABLE (valider / rouvrir un
   * `valide_modifiable`) — geste de verrouillage protégé (A18 §6 Q4). Un cran irréversible (`reouvrable:false` :
   * réservation, paiement, ferry, dates A/R, trajet A/R figé) ne se rouvre PAS, PIN ou non.
   */
  pin?: string;
}

/** Résultat d'une transition. `ok:false` + `raison` = refus métier (rôle insuffisant, cran non rouvrable, dépendance aval). */
export interface TransitionResult {
  ok: boolean;
  raison?: string;
  etat?: EtatParcours;
  /** Crans aval invalidés par la réouverture (à recomputer/refaire), le cas échéant. */
  aval_invalide?: CranId[];
}

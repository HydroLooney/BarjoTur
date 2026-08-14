// Contrats de la passe d'enrichissement (A28) : provenance tracée, signal communauté PAR LANGUE, photos, description /
// Wikipédia. Alimentés par la réconciliation (A, `A28_reconciliation_prep.sql`), consommés par le front (fiche lieu
// enrichie). Décisions Guillaume : signal par aire linguistique, photos de confiance (Wikimedia prioritaire), un canal
// fixe la réputation (garde anti-double-comptage), tout tracé (R1).

/** Aire linguistique d'une communauté de voyageurs (les 5 grappes de recherche). */
export type AireLangue = 'scandinave' | 'nl_de' | 'fr_be' | 'anglophone' | 'russophone';

/** Canal d'endossement d'un lieu. Un SEUL fixe la réputation (fusion) ; les autres modulent ou tracent. */
export type CanalProvenance = 'guide_papier' | 'communaute' | 'base_v2' | 'wikipedia';

/** Une photo d'un lieu. Licence et attribution OBLIGATOIRES (R1) ; jamais de photo non sourcée. */
export interface PoiPhoto {
  url: string;
  /** Ex. « Wikimedia Commons », ou le blog/source d'origine. */
  source: string;
  /** Ex. « CC BY-SA 4.0 » ; ou « usage perso, source citée » pour une source non réutilisable. */
  licence: string;
  attribution: string;
  legende?: string;
}

/** Signal communautaire d'un lieu pour UNE aire linguistique : combien de sources indépendantes, à quel niveau, perle ? */
export interface SignalCommunaute {
  aire_langue: AireLangue;
  n_sources: number;
  /** Niveau d'endossement normalisé [0..1]. */
  endossement: number;
  perle: boolean;
  liens?: string[];
}

/** Trace d'un canal d'endossement (R1, re-tunable) : ce qu'il apporte au tier fusionné, conservé après fusion. */
export interface ProvenanceEndossement {
  canal: CanalProvenance;
  source: string;
  n_sources: number;
  endossement?: number;
  /** Cran de tier dérivé (T/S/A/B/C/D) pour un canal guide/base. */
  cran_tier?: string;
  score_original?: number;
  drapeau_desaccord?: boolean;
}

/** Enrichissement d'un lieu (A28) : ce que la passe ajoute au POI, avec provenance et traçabilité. Tout optionnel. */
export interface PoiEnrichissement {
  poi_id: number;
  /** Nom norvégien normalisé (clé de matching). */
  nom_no?: string;
  description?: string;
  ce_qu_il_sen_dit?: string;
  wikipedia_url?: string;
  wikipedia_resume?: string;
  photos?: PoiPhoto[];
  signaux_communaute?: SignalCommunaute[];
  provenance?: ProvenanceEndossement[];
}

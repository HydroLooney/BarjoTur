// Mise en avant d'un lieu (A24 / M110) : étiquette « à la Michelin » dérivée du score (reward + endossement des
// guides, calculé par A, gaté DSN). Trois niveaux au-dessus du lot, rien en dessous. Les libellés sont au
// glossaire ; les couleurs passent par les variants de Badge existants (dark-safe, zéro nouvelle palette). Les
// SEUILS ci-dessous sont une présentation front illustrative (R1) : au flip, A peut fournir l'étiquette
// directement, ou l'on cale les seuils sur le vrai score. La DÉCISION du composeur (score continu) est côté B.
export type MiseEnAvant = 'vaut_le_voyage' | 'vaut_le_detour' | 'au_passage';

export const LIBELLE_MISE_EN_AVANT: Record<MiseEnAvant, string> = {
  vaut_le_voyage: 'Vaut le voyage',
  vaut_le_detour: 'Vaut le détour',
  au_passage: 'Au passage',
};

/** Variant de Badge par niveau (sobre, dégressif). */
export const VARIANTE_MISE_EN_AVANT: Record<MiseEnAvant, 'primaire' | 'contour' | 'neutre'> = {
  vaut_le_voyage: 'primaire',
  vaut_le_detour: 'contour',
  au_passage: 'neutre',
};

/**
 * Étiquette d'un lieu depuis son score (`score_mcda`, ~[0..1]). Au-dessus des seuils : les trois niveaux ; en
 * dessous : `null` (pas d'étiquette, on ne surcharge pas la carte). Seuils illustratifs, à caler au flip.
 */
export function miseEnAvantDeScore(score: number | null | undefined): MiseEnAvant | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= 0.85) return 'vaut_le_voyage';
  if (score >= 0.65) return 'vaut_le_detour';
  if (score >= 0.45) return 'au_passage';
  return null;
}

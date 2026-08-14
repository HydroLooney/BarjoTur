import type { MiseEnAvant } from '@barjotur/shared';

// Mise en avant d'un lieu (A24 / M110) : étiquette « à la Michelin » précalculée par A (reward + endossement des
// guides, gaté DSN). Le TYPE est SOURCE UNIQUE dans `@barjotur/shared` (M121), on le réexporte. Trois niveaux
// au-dessus du lot, rien en dessous. Libellés au glossaire ; couleurs par variants de Badge existants (dark-safe).
// Les SEUILS ci-dessous ne sont qu'un repli front illustratif (R1) pour dériver l'étiquette d'un `score_mcda` tant
// que A ne fournit pas le `MiseEnAvant` direct ; le composant accepte déjà un `niveau` shared direct.
export type { MiseEnAvant };

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

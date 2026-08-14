// Sentiers rando (T048 / M098) : la couche `diffusion.v_web_sentiers` d'A (Turrutebasen, difficulté DNT). Style
// par difficulté (5 niveaux), légende et libellés au glossaire (zéro jargon). Les couleurs passent par des JETONS
// de charte existants (dark-safe, zéro hex dans le JS) ; on ne réinvente pas de palette. Les sentiers n'ont de
// sens qu'au zoom (sinon la carte nationale est illisible) : un seuil `SENTIERS_MINZOOM` les révèle.

/** Zoom à partir duquel on affiche les sentiers (échelle régionale ; en dessous = illisible). */
export const SENTIERS_MINZOOM = 9;

export interface NiveauDifficulte {
  /** Valeur portée par `v_web_sentiers.difficulte` (à confirmer à la bascule live). */
  code: string;
  /** Libellé au glossaire, enfant-compatible. */
  libelle: string;
  /** Jeton de charte (résolu par `charte()`), dark-safe. */
  token: string;
}

// Ordre du plus facile au plus dur ; le « non gradé » ferme la liste et sert de défaut (difficulté inconnue).
export const DIFFICULTES: NiveauDifficulte[] = [
  { code: 'facile', libelle: 'Facile', token: '--vert' },
  { code: 'moyen', libelle: 'Moyen', token: '--accent' },
  { code: 'difficile', libelle: 'Difficile', token: '--ocre' },
  { code: 'expert', libelle: 'Expert', token: '--destructive' },
  { code: 'non gradé', libelle: 'Non classé', token: '--muted-foreground' },
];

/** Libellé lisible d'une difficulté (repli sur la valeur brute si inconnue). */
export function libelleDifficulte(code: string | null | undefined): string {
  return DIFFICULTES.find((d) => d.code === code)?.libelle ?? (code ? String(code) : 'Non classé');
}

/**
 * Id de couche MapLibre pour une difficulté (une couche filtrée + couleur solide par niveau, comme le pattern
 * POI votable/repère : entièrement typé, pas d'expression `match`). Espaces normalisés (« non gradé »).
 */
export function layerIdSentier(code: string): string {
  return `sentiers-${code.replace(/\s+/g, '-')}`;
}

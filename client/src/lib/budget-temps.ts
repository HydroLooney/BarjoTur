import { PAS_MIN, type BudgetTempsVisite } from '@barjotur/shared';

// Réglage du budget-temps d'une visite côté écran (M089 / A21). Le CALCUL de la durée proposée vit chez A
// (avis + appétits) ; ici, la seule logique front est l'AJUSTEMENT manuel : clamp aux bornes, arrondi au pas de
// 15 min (jamais 30), et contrainte de palier pour une activité « en bloc » (kayak). Pur et testable sur
// fixture, non gaté DSN. Jamais sous le plancher ni sous le plus petit palier (« en dessous compliqué pour elle »).

type ContrainteDuree = Pick<
  BudgetTempsVisite,
  'min_min' | 'max_min' | 'pas_min' | 'granularite' | 'granularites'
>;

/** Arrondit une durée (minutes) au pas donné (défaut 15), au plus proche. */
export function arrondiPas(min: number, pas: number = PAS_MIN): number {
  const p = pas > 0 ? pas : PAS_MIN;
  return Math.round(min / p) * p;
}

/** Palier offert le plus proche d'une valeur, jamais en dessous du plus petit palier. */
export function contraindrePalier(min: number, paliers: number[]): number {
  const tries = [...paliers].filter((p) => p > 0).sort((a, b) => a - b);
  if (tries.length === 0) return Math.max(0, min);
  const plancher = tries[0] as number;
  if (min <= plancher) return plancher;
  let best = plancher;
  let bestEcart = Number.POSITIVE_INFINITY;
  for (const p of tries) {
    const ecart = Math.abs(p - min);
    if (ecart < bestEcart) {
      bestEcart = ecart;
      best = p;
    }
  }
  return best;
}

/**
 * Ajuste une durée brute (curseur ou saisie) aux contraintes d'une visite.
 * - `libre` : clamp [min, max] puis arrondi au pas, re-clampé (l'arrondi peut déborder ; le plancher gagne).
 * - `demi_journee` / `journee` : contrainte au palier offert le plus proche (jamais sous le plus petit).
 */
export function ajusterDuree(brut: number, c: ContrainteDuree): number {
  if (c.granularite !== 'libre') {
    return contraindrePalier(brut, c.granularites ?? []);
  }
  const pas = c.pas_min || PAS_MIN;
  const haut = c.max_min ?? Number.POSITIVE_INFINITY;
  const borne = Math.min(Math.max(brut, c.min_min), haut);
  const arrondi = arrondiPas(borne, pas);
  // Le plancher prime sur l'arrondi ; le plafond aussi s'il existe.
  const basPlancher = Math.max(arrondi, c.min_min);
  return haut === Number.POSITIVE_INFINITY ? basPlancher : Math.min(basPlancher, haut);
}

/** Normalise un appétit thématique dans [0, 1] (0 = neutre, 1 = fort). */
export function clampAppetit(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Flânerie d'un jour : >= 0, arrondie au pas de 15 min. */
export function ajusterFlanerie(min: number): number {
  return Math.max(0, arrondiPas(Number.isNaN(min) ? 0 : min, PAS_MIN));
}

/** Durée lisible en français : « 45 min », « 1 h », « 2 h 30 ». */
export function formatDuree(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

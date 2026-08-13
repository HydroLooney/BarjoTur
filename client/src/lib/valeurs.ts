/** Borne une valeur dans [min, max] et la cale sur le pas depuis min. NaN -> min. */
export function clampValeur(v: number, min: number, max: number, step = 1): number {
  if (Number.isNaN(v)) return min;
  const borne = Math.min(max, Math.max(min, v));
  if (step <= 0) return borne;
  // Calage sur le pas depuis min, puis correction des erreurs de flottant (0.1 + 0.2...).
  const cale = min + Math.round((borne - min) / step) * step;
  const arrondi = Math.round(cale * 1e6) / 1e6;
  return Math.min(max, Math.max(min, arrondi));
}

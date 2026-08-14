// Modèle carburant (M090/M092, T045). MIROIR TEMPORAIRE de `server/domain/carburant.ts` (B044) : B demande
// à M de HISSER ce calcul en `@barjotur/shared` pour une source unique (B en autorité budget, C au curseur,
// exactement comme `peut()`). Tant que le module shared n'est pas posé, on garde ce miroir pour tenir la
// consigne M092 (« le calcul se fait dès maintenant sur fixture ») SANS bloquer ; dès que M hisse, on remplace
// cet import par `@barjotur/shared` (swap trivial, on supprime ce fichier). R1 : duplication ASSUMÉE et flaggée,
// à résorber (jamais deux vérités durables). Remonté à M (C0xx).

/** Consommation de base du van, caractéristique fixe (non éditable), L/100 km. */
export const CONSO_BASE_L_100 = 9.5;
/** Prix diesel de référence, €/L. */
export const PRIX_DIESEL_BASE = 2.0;
/** Bornes indicatives du curseur prix diesel, €/L. */
export const PRIX_DIESEL_MIN = 1.5;
export const PRIX_DIESEL_MAX = 2.8;
/** Borne indicative du curseur surconsommation, en %. */
export const SURCONSO_PCT_MAX = 50;

/** Consommation effective (L/100 km) : base × (1 + surconsommation%). `base` en dernier arg pour un futur multi-van (T027). */
export function consoEffectiveL100(surconsoPct: number, base: number = CONSO_BASE_L_100): number {
  const s = Number.isNaN(surconsoPct) ? 0 : Math.max(0, surconsoPct);
  return base * (1 + s / 100);
}

/** Coût carburant (€) : (conso effective / 100) × prix diesel × km. */
export function coutCarburantEur(
  km: number,
  surconsoPct: number,
  prixDiesel: number,
  base: number = CONSO_BASE_L_100,
): number {
  const kmSain = Number.isNaN(km) ? 0 : Math.max(0, km);
  const prix = Number.isNaN(prixDiesel) ? 0 : Math.max(0, prixDiesel);
  return (consoEffectiveL100(surconsoPct, base) / 100) * prix * kmSain;
}

/** Applique une marge de sécurité en % à un montant (Guillaume : marges réglables et recalculées en %). */
export function avecMarge(montantEur: number, margePct: number): number {
  const m = Number.isNaN(margePct) ? 0 : Math.max(0, margePct);
  return montantEur * (1 + m / 100);
}

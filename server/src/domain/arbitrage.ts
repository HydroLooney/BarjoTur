// Arbitrage bi-critère temps↔argent d'une LIAISON base→base (M073) désormais CANONIQUE dans @barjotur/shared (posé par
// M, 45c8e92, M093 : repris verbatim de ce module, + `km` requis sur VarianteLiaison pour recomposer le carburant quand
// le curseur bouge). Re-export : une seule vérité, consommée par B (composeur/budget) ET C (affichage + curseur
// temps↔argent). `carburant_eur` = valeur au param de base (A la calcule), recomposable via `coutCarburantEur(km, …)` ;
// ferry/péage = tarifs, inchangés par le slider.

export type { ModeVariante, CoutLiaison, VarianteLiaison } from '@barjotur/shared';
export { coutTotalEur, frontPareto, choisirVariante } from '@barjotur/shared';

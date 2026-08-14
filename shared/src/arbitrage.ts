// Arbitrage bi-critère temps↔argent d'une LIAISON base→base (M073). PUR, sans DB. Forme canonique partagée :
// B en fait autorité (composeur), C l'affiche (« par le ferry 1 h / 30 € » vs « par la route 2 h 10 / gratuit »)
// et règle le curseur temps↔argent sur `choisirVariante`. A produit les variantes (routage), ce module ne fait
// que la sélection. Hissé de server/domain/arbitrage.ts (B), enrichi du `km` (B044) pour recomposer le carburant.

/** Route évitée ou non : défaut (rapide, ferry+péage permis), sans ferry (contournement terrestre), sans péage (gratuit). */
export type ModeVariante = 'defaut' | 'sans_ferry' | 'sans_peage';

/** Coût en euros d'une variante, détaillé par poste (aligné sur les postes budget carburant/ferry/péage). */
export interface CoutLiaison {
  carburant_eur: number;
  ferry_eur: number;
  peage_eur: number;
}

/**
 * Une variante de route d'une liaison base→base : son mode, son temps (min), sa distance (km) et son coût détaillé.
 * `km` est requis : sans lui, le carburant ne se recompose pas quand le curseur bouge (B044). `carburant_eur` porte
 * la valeur au param de base (calculée par A) ; B et C la recomposent via `coutCarburantEur(km, …)`. Ferry et péage
 * sont des tarifs, indépendants du slider carburant.
 */
export interface VarianteLiaison {
  mode: ModeVariante;
  temps_min: number;
  km: number;
  cout: CoutLiaison;
}

/** Coût total en euros d'une variante = carburant + ferry + péage. Pur. */
export function coutTotalEur(v: VarianteLiaison): number {
  return v.cout.carburant_eur + v.cout.ferry_eur + v.cout.peage_eur;
}

/** `a` domine `b` : au moins aussi rapide ET au moins aussi économe, strictement mieux sur au moins un critère. */
function domine(a: VarianteLiaison, b: VarianteLiaison): boolean {
  const auMoinsAussiBon = a.temps_min <= b.temps_min && coutTotalEur(a) <= coutTotalEur(b);
  const strictementMieux = a.temps_min < b.temps_min || coutTotalEur(a) < coutTotalEur(b);
  return auMoinsAussiBon && strictementMieux;
}

/**
 * Front de Pareto temps↔argent : ne garde que les variantes non dominées (aucune autre n'est à la fois plus rapide ET
 * plus économe). C'est l'ensemble des choix rationnels à présenter à l'utilisateur. Ordre d'entrée préservé. Pur.
 */
export function frontPareto(variantes: VarianteLiaison[]): VarianteLiaison[] {
  return variantes.filter((v) => !variantes.some((autre) => autre !== v && domine(autre, v)));
}

/**
 * Choisit une variante selon la VALEUR DU TEMPS de l'utilisateur (€/h) : minimise `coût_total + valeurTemps * heures`.
 * valeurTemps = 0 → la moins chère (argent pur) ; valeurTemps grand → la plus rapide (temps pur). Le curseur temps↔argent
 * de l'UI se mappe sur cette valeur. Précondition : au moins une variante. Pur.
 */
export function choisirVariante(variantes: VarianteLiaison[], valeurTempsEurParHeure: number): VarianteLiaison {
  if (variantes.length === 0) {
    throw new Error('choisirVariante : au moins une variante est requise.');
  }
  const scalaire = (v: VarianteLiaison): number => coutTotalEur(v) + valeurTempsEurParHeure * (v.temps_min / 60);
  return variantes.reduce((meilleure, v) => (scalaire(v) < scalaire(meilleure) ? v : meilleure));
}

// Coût carburant, recomposé à la volée (modèle Guillaume, 14/08). Source UNIQUE : la FONCTION et les constantes
// vivent ici (consommées en autorité budget par B et au curseur par C, comme `peut()`) ; les VALEURS des params
// réglés vivent côté calcul (`routing_params`, A). Le slider ne recalcule jamais la matrice : le km est fixe, seul
// le € se recompose depuis les params. Décision Guillaume : conso base FIXE (caractéristique du van) + slider de
// surconsommation « % de plus » + prix diesel réglable ; le tout dans les marges/sécurité (T045).

/** Consommation de base du van retenu, en L/100 km. Caractéristique du véhicule, fixe pour ce voyage. */
export const CONSO_BASE_L_100 = 9.5;
/** Prix du diesel de référence, en €/L. */
export const PRIX_DIESEL_BASE = 2.0;
/** Bornes indicatives du slider prix diesel, en €/L (Guillaume : de 1,50 à 2,80, voire au-delà). */
export const PRIX_DIESEL_MIN = 1.5;
export const PRIX_DIESEL_MAX = 2.8;

/**
 * Consommation effective en L/100 km, la surconsommation étant un « % de plus » sur la base (van chargé, relief,
 * vent). `conso_base` en dernier argument optionnel prépare le multi-van (T027) sans casser l'appel courant.
 */
export function consoEffectiveL100(surconso_pct: number, conso_base = CONSO_BASE_L_100): number {
  return conso_base * (1 + surconso_pct / 100);
}

/**
 * Coût carburant d'un trajet, en euros = (conso effective / 100) × prix diesel × km. Le km est fixe (matrice) ;
 * bouger les curseurs recompose le € à la volée. Calcul exact, l'arrondi relève de l'affichage.
 */
export function coutCarburantEur(
  km: number,
  surconso_pct: number,
  prix_diesel: number,
  conso_base = CONSO_BASE_L_100,
): number {
  return (consoEffectiveL100(surconso_pct, conso_base) / 100) * prix_diesel * km;
}

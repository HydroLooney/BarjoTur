import type { Circuit, DureeCircuit, ModeCircuit } from '@barjotur/shared';

// Bibliothèque de circuits (M108) : filtrage et libellés au glossaire (zéro jargon). Pur et testable ; les
// données viennent de la fixture hors live, des endpoints de B au flip. Un circuit du guide est un canevas
// souple : on garde son mode d'origine pour information, l'adoption le re-route en van/rando (côté A, gaté DSN).

/** Mode d'origine d'un circuit, dit en clair. */
export const MODE_CIRCUIT: Record<ModeCircuit, string> = {
  pied: 'à pied',
  velo: 'à vélo',
  voiture: 'en voiture',
  van: 'en van',
  train: 'en train',
  bateau: 'en bateau',
  mixte: 'mixte',
};

/** Grain de durée d'un circuit, dit en clair. */
export const DUREE_CIRCUIT: Record<DureeCircuit, string> = {
  demi_journee: 'demi-journée',
  '24h': '24 h',
  journee: 'journée',
  jours: 'plusieurs jours',
};

export interface FiltresCircuit {
  zone?: string | null;
  duree?: DureeCircuit | null;
  mode?: ModeCircuit | null;
}

/** Filtre une bibliothèque de circuits par zone, durée et mode d'origine (chaque critère est optionnel). */
export function filtrerCircuits(circuits: Circuit[], f: FiltresCircuit): Circuit[] {
  return circuits.filter(
    (c) =>
      (!f.zone || c.zone === f.zone) &&
      (!f.duree || c.duree === f.duree) &&
      (!f.mode || c.mode_origine === f.mode),
  );
}

/** Les zones distinctes présentes dans la bibliothèque, triées. */
export function zonesDisponibles(circuits: Circuit[]): string[] {
  const zones = circuits.map((c) => c.zone).filter((z): z is string => !!z);
  return [...new Set(zones)].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Durée lisible d'un circuit (le nombre de jours s'il est connu, sinon le grain). */
export function libelleDuree(c: Circuit): string {
  if (c.duree === 'jours' && c.jours) return `${c.jours} jours`;
  return DUREE_CIRCUIT[c.duree];
}

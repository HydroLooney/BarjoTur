// Sélection bi-critère d'une variante de liaison AVEC préférences éviter-ferry / éviter-péage (M240), posée
// PAR-DESSUS le curseur temps↔argent canonique (`choisirVariante`, ./arbitrage). PUR, sans DB ni sidecar.
// Hissé en @barjotur/shared (M252) depuis server/src/domain/variantes.ts (B, M240) pour que le composeur (server)
// ET l'UI (client) pilotent les bascules « éviter ferry/péage » sur la MÊME logique (comme arbitrage, carburant).
//
// Principe : les préférences « éviter ferry » et « éviter péage » partitionnent les variantes en CONFORMES (qui
// évitent ce que l'utilisateur veut éviter) et non conformes ; on choisit dans les conformes via le curseur
// temps↔argent existant. En mode STRICT (contrainte dure), s'il n'existe aucune variante conforme la liaison est
// infaisable sous cette contrainte → on rend `null` (R1 : on ne prétend pas router ce qu'on ne peut pas). En mode
// DOUX (défaut), on se replie sur le meilleur global et on SIGNALE que la préférence n'a pas pu être honorée.
//
// « utilise un ferry / un péage » se lit sur le coût (>0) comme proxy honnête : une variante `sans_ferry` a
// ferry_eur=0 par construction, mais une `defaut` sans traversée disponible aussi — on juge sur le fait, pas sur
// l'étiquette de mode. Quand A figera un vrai booléen `traverse`/`peage` sur la variante, ce module s'y branchera.

import { choisirVariante, type VarianteLiaison } from './arbitrage.js';

/** La variante emprunte un ferry (proxy : un tarif de traversée > 0). Pur. */
export function utiliseFerry(v: VarianteLiaison): boolean {
  return v.cout.ferry_eur > 0;
}

/** La variante emprunte un péage (proxy : un tarif de péage > 0). Pur. */
export function utilisePeage(v: VarianteLiaison): boolean {
  return v.cout.peage_eur > 0;
}

/** Préférences de sélection : arbitrage temps↔argent + éviter ferry/péage, en contrainte dure (`strict`) ou douce. */
export interface PreferencesVariante {
  /** €/h : arbitrage temps↔argent, passé tel quel à `choisirVariante` (0 = le moins cher, grand = le plus rapide). */
  valeurTempsEurParHeure: number;
  /** Préférer une route sans ferry. */
  eviterFerry?: boolean;
  /** Préférer une route sans péage. */
  eviterPeage?: boolean;
  /** Contrainte DURE : n'accepte que des variantes conformes ; si aucune, la liaison est infaisable (→ null). */
  strict?: boolean;
}

/** Résultat de sélection : la variante retenue + si elle respecte réellement les préférences (false = repli doux). */
export interface ResultatSelection {
  variante: VarianteLiaison;
  preferencesRespectees: boolean;
}

/** Une variante respecte les préférences si elle n'emprunte pas ce que l'utilisateur veut éviter. Pur. */
function respecte(v: VarianteLiaison, prefs: PreferencesVariante): boolean {
  if (prefs.eviterFerry && utiliseFerry(v)) return false;
  if (prefs.eviterPeage && utilisePeage(v)) return false;
  return true;
}

/**
 * Choisit une variante de liaison sous préférences éviter-ferry/éviter-péage, puis curseur temps↔argent.
 * - Variantes conformes non vides → la meilleure d'entre elles au curseur, `preferencesRespectees: true`.
 * - Aucune conforme + `strict` → `null` (infaisable sous contrainte dure).
 * - Aucune conforme + doux → meilleure globale au curseur, `preferencesRespectees: false`.
 * Précondition : au moins une variante (sinon erreur, comme `choisirVariante`). Pur.
 */
export function selectionnerVariante(
  variantes: VarianteLiaison[],
  prefs: PreferencesVariante,
): ResultatSelection | null {
  if (variantes.length === 0) {
    throw new Error('selectionnerVariante : au moins une variante est requise.');
  }
  const conformes = variantes.filter((v) => respecte(v, prefs));
  if (conformes.length > 0) {
    return {
      variante: choisirVariante(conformes, prefs.valeurTempsEurParHeure),
      preferencesRespectees: true,
    };
  }
  if (prefs.strict) {
    return null;
  }
  return {
    variante: choisirVariante(variantes, prefs.valeurTempsEurParHeure),
    preferencesRespectees: false,
  };
}

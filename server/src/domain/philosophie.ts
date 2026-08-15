// Contrats philosophie : CANONIQUES dans @barjotur/shared (posés par M, 3c46a57, crible B159). Re-export.
// Le BFF branche les endpoints + le mapping du sens (profil → signature composeur) ; C hydrate le questionnaire.

export type {
  PhilosophieProfil,
  PhilosophieReponse,
  PhilosophieMajInput,
  CurseurCatalogue,
  EnvieCatalogue,
  CurseurCle,
  EnvieCle,
} from '@barjotur/shared';
export { CURSEUR_CLES, ENVIE_CLES } from '@barjotur/shared';

/**
 * Signature d'objectif du composeur (mêmes champs que mcda2.archetype_signature). Le mapping du sens (note 04 → poids)
 * la produit à partir du profil d'un voyageur (Mon voyage). LIVE : signature unique passée au sidecar ; leximin famille = v3.1.
 * `themes` porte les 4 envies (th_*) ; la formule exacte (orness/THEME_W/renorm) est raffinée en v3.1 (M508).
 */
export interface SignatureComposeur {
  w_nat: number;
  w_gra: number;
  w_tra: number;
  w_ran: number;
  w_biv: number;
  w_inc: number;
  biais_nord: number;
  cap_hard_h: number;
  cadence: number;
  anti_foule: number;
  autonomie: number;
  /** Poids d'envie par thème (paysage/rando/nautique/culturel), [0..1]. Câblage THEME_W exact = v3.1. */
  themes: { paysage: number; rando: number; nautique: number; culturel: number };
}

// Sélection bi-critère d'une variante de liaison AVEC préférences éviter-ferry / éviter-péage (M240) désormais
// CANONIQUE dans @barjotur/shared (posée par M, 6f0676f, M252 : miroir exact de ce module). Re-export : une seule
// vérité, consommée par B (composeur) ET C (bascules « éviter ferry » / « éviter péage » de l'UI). La logique est
// posée par-dessus le curseur temps↔argent (`choisirVariante`) : mode doux = repli signalé `preferencesRespectees:false`,
// mode strict = `null` si aucune variante conforme. Voir aussi domain/arbitrage.ts (même patron de re-export).

export type {
  ModeVariante,
  CoutLiaison,
  VarianteLiaison,
  PreferencesVariante,
  ResultatSelection,
} from '@barjotur/shared';
export {
  coutTotalEur,
  frontPareto,
  choisirVariante,
  utiliseFerry,
  utilisePeage,
  selectionnerVariante,
} from '@barjotur/shared';

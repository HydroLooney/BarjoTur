// Coût carburant du van (T045, M090) désormais CANONIQUE dans @barjotur/shared (posé par M, 45c8e92, M093). Re-export :
// une seule vérité, consommée par B (autorité budget) ET C (curseur live). Les VALEURS des params vivent en
// routing_params (A) ; la FONCTION et les constantes sont partagées. Le km d'une liaison est fixe (matrice), le € se
// recompose à la volée. Voir aussi domain/arbitrage (VarianteLiaison porte `km`).

export {
  CONSO_BASE_L_100,
  PRIX_DIESEL_BASE,
  PRIX_DIESEL_MIN,
  PRIX_DIESEL_MAX,
  consoEffectiveL100,
  coutCarburantEur,
} from '@barjotur/shared';

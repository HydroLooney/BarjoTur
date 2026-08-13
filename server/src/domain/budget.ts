// Budget et paramètres single-source (Budget C13, Coulisses C09). Le budget est un passe-plat des RPC ;
// les paramètres viennent de la vue api.parametres (registre single-source budget.parametre).
//
// `BudgetComparatif` est canonique dans @barjotur/shared (M024) : on le re-exporte. `Parametre` (vue api.parametres)
// reste local au BFF pour l'instant.

export type { BudgetComparatif } from '@barjotur/shared';

/** Une ligne du registre single-source (vue api.parametres). recommandé vs choisi, avec justification. */
export interface Parametre {
  cle: string;
  valeur: string | null;
  valeur_recommandee: string | null;
  source_reco: string | null;
  justification: string | null;
  unite: string | null;
  type: string | null;
  defaut: string | null;
  categorie: string | null;
  confiance: string | null;
}

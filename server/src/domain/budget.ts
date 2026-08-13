// Budget et paramètres single-source (Budget C13, Coulisses C09). Le budget est un passe-plat des RPC ;
// les paramètres viennent de la vue api.parametres (registre single-source budget.parametre).
//
// Types locaux au BFF (passe-plat + un `Parametre` calqué sur la vue). À canoniser dans @barjotur/shared/budget.ts
// si le front en a besoin (demande à poser à M).

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

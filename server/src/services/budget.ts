// Service budget et paramètres. Passe-plat des RPC api.budget_* et lecture de la vue api.parametres.
// Ne connaît pas Express. Lecture seule sur DB2. Le budget est un prévisionnel, pas une cible (R1).

import { appelerRpc, argBigint } from '../db/rpc.js';
import { query } from '../db/query.js';
import type { Parametre, BudgetComparatif } from '../domain/budget.js';

/** Budgets comparés par scénario (van, carburant, hébergement, repas, ferry, activités...). Passe-plat. */
export async function budgetComparatif(): Promise<BudgetComparatif[]> {
  return appelerRpc<BudgetComparatif[]>('budget_comparatif', []);
}

/** Budget détaillé d'un itinéraire figé donné. Passe-plat. */
export async function budgetVariante(figeId: number): Promise<BudgetComparatif> {
  return appelerRpc<BudgetComparatif>('budget_variante', [argBigint(figeId)]);
}

/** Registre single-source des paramètres (recommandé vs choisi, justification). Pour la page Coulisses. */
export async function lesParametres(): Promise<Parametre[]> {
  return query<Parametre>(
    `select cle, valeur, valeur_recommandee, source_reco, justification, unite, type, defaut, categorie, confiance
       from api.parametres order by categorie, cle`,
  );
}

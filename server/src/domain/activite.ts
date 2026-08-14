// Budget-temps d'un POI (A048/M089) — types du passe-plat. Les contrats d'activité sont canoniques dans
// @barjotur/shared (activite.ts, posé par M) : on les réexporte. `BudgetTempsPoi` = ce que rend `api.budget_temps_poi`
// (A048) : la visite résolue (durée modulée par avis+appétits) + ses thèmes. Forme jsonb proposée à A (visite+themes).

export type { BudgetTempsVisite, Theme, TypeActivite, Granularite } from '@barjotur/shared';

import type { BudgetTempsVisite, Theme } from '@barjotur/shared';

/** Retour de `api.budget_temps_poi(poi_id)` : la visite budget-temps résolue pour un POI + ses thèmes (A048). */
export interface BudgetTempsPoi {
  visite: BudgetTempsVisite;
  themes: Theme[];
}

// Contrats budget (passe-plat de api.budget_comparatif / api.budget_variante, shapes B023).
// Deux lectures du budget d'un ou plusieurs figés : prudente (marges hautes) et non prudente.

export interface BudgetPostes {
  van: number;
  activites: number;
  carburant: number;
  hebergement: number;
  repas_courses: number;
  ferry_interieur: number;
  ferry_international: number;
  /** Péages (NVDB bomstasjon, van chargé). Nouvelle dimension € du routage van (A035/A037). Additif : présent dès que projeté (006). */
  peages?: number;
  /** Étapes de transit (A/R et transits insérés) : carburant + péages + ferry + nuits, autonomie par défaut (A19 §8.4). Additif : présent dès que projeté (006). */
  transit?: number;
}

export interface BudgetParAdulte {
  note: string;
  nb_adultes: number;
  prudent_eur: number;
  non_prudent_eur: number;
}

export interface BudgetAlertes {
  hard_cap_eur: number;
  soft_cap_eur: number;
  depasse_hard_prudent: boolean;
  depasse_soft_prudent: boolean;
  depasse_hard_non_prudent: boolean;
  depasse_soft_non_prudent: boolean;
}

/** Budget comparatif d'un figé (une ligne par profil comparé). `budget_variante(fige_id)` rend la même forme. */
export interface BudgetComparatif {
  fige_id: number | null;
  code: string | null;
  label: string | null;
  source: string;
  archetype_key: string | null;
  prenom: string | null;
  km: number;
  nuits: number;
  postes: BudgetPostes;
  par_adulte: BudgetParAdulte;
  alertes: BudgetAlertes;
  total_prudent_eur: number;
  total_non_prudent_eur: number;
}

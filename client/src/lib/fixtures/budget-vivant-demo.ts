import type { BudgetVivant } from '@barjotur/shared';

// APERÇU DEV du budget vivant (#3), pour construire et CAPTURER le rendu tant que l'endpoint B177 n'est pas déployé.
// Chargé seulement en DEV avec `?budget-vivant` (jamais en production). Ce ne sont PAS des chiffres réels (R1) : juste
// des exemples de structure (3 sources, réservations, totaux) pour voir la vue. Au flip, `useBudgetVivant` prend la
// vraie source serveur.

export const budgetVivantDemo: BudgetVivant = {
  postes: {
    van: 2827,
    activites: 640,
    carburant: 720,
    hebergement: 980,
    repas_courses: 1150,
    ferry_interieur: 210,
    ferry_international: 686,
    peages: 180,
    transit: 540,
  },
  sources: [
    { source: 'marges_expert', montant_eur: 8730, marge_pct: 20 },
    { source: 'itineraire', montant_eur: 7975, marge_pct: null },
    { source: 'reservations', montant_eur: 3513, marge_pct: null },
  ],
  total_min_eur: 7975,
  total_max_eur: 8730,
  reservations: [
    { id: 1, poste: 'van', libelle: 'Van Rapido V65XL (Yescapa)', montant_eur: 2827, statut: 'paye', date: '2027-05-14' },
    { id: 2, poste: 'ferry_international', libelle: 'Fjord Line aller-retour', montant_eur: 686, statut: 'paye', date: '2027-04-02' },
    { id: 3, poste: 'activites', libelle: 'Croisière Geirangerfjord', montant_eur: 156, montant_nok: 1810, statut: 'acompte', date: '2027-08-11' },
    { id: 4, poste: 'hebergement', libelle: 'Camping Lofoten (2 nuits)', montant_eur: 92, montant_nok: 1070, statut: 'pressenti', date: '2027-08-18' },
  ],
  total_engage_eur: 3513,
  suivi: [],
  total_reel_eur: 0,
  reste_eur: 5217,
  soft_cap_eur: 9000,
  hard_cap_eur: 10500,
  devise: 'EUR',
};

import type { AgendaVoyage } from '@barjotur/shared';

// APERÇU DEV de l'agenda du jour (M499/M502 §1-2), pour construire et CAPTURER le rendu tant que l'endpoint B est en
// construction (M527). N'est chargé qu'en DEV avec `?agenda` (jamais en production) — ce ne sont PAS des données
// réelles (R1), juste des exemples de structure pour voir la carte du jour et l'agenda groupé. Au flip, `useAgenda`
// remplace ceci par la vraie source serveur.

export const agendaDemo: AgendaVoyage = {
  ancre_depart: 'Kristiansand',
  ancre_retour: 'Kristiansand',
  budget_temps_total_min: 12_600,
  jours: [
    {
      jour: 8,
      date: '2027-08-11',
      lieu: 'Geiranger',
      theme: 'le fjord classé, avant les heures de foule',
      perle: true,
      lever: '06:15',
      coucher: '22:40',
      budget_temps_min: 540,
      temps_consomme_min: 500,
      densite: 'modere',
      activites: [
        {
          heure: '07:30',
          duree_min: 90,
          titre: 'Route de l’Aigle (Ørnesvegen)',
          sous_titre: 'les lacets et le belvédère sur le fjord',
          groupe_moment: 'matin',
          contrainte: 'souple',
        },
        {
          heure: '10:00',
          duree_min: 150,
          titre: 'Rando au refuge de Skageflå',
          sous_titre: 'ferme perchée au-dessus du fjord, montée raide',
          groupe_moment: 'matin',
          contrainte: 'souple',
        },
        {
          heure: '13:00',
          duree_min: 60,
          titre: 'Pause déjeuner au bord de l’eau',
          groupe_moment: 'midi',
          contrainte: 'souple',
        },
        {
          heure: '15:30',
          duree_min: 75,
          titre: 'Croisière sur le Geirangerfjord',
          sous_titre: 'les Sept Sœurs depuis le pont',
          groupe_moment: 'apres_midi',
          contrainte: 'heure',
          payant: true,
          cout_eur: 39,
        },
        {
          heure: '19:00',
          duree_min: 45,
          titre: 'Installation à l’aire du soir',
          groupe_moment: 'soir',
          contrainte: 'souple',
        },
      ],
      confort: {
        laverie: false,
        laverie_jours_depuis: 3,
        laverie_jours_avant: 2,
        streak_autonomie: 1,
        alerte_ppc: false,
        type_nuit: 'aire',
        cout_nuit_eur: 28,
      },
    },
    {
      jour: 9,
      date: '2027-08-12',
      lieu: 'Trollstigen',
      theme: 'la route des trolls, tôt pour l’avoir à soi',
      perle: false,
      lever: '06:10',
      coucher: '22:50',
      budget_temps_min: 480,
      temps_consomme_min: 560,
      densite: 'depasse',
      activites: [
        {
          heure: '06:45',
          duree_min: 120,
          titre: 'Montée du Trollstigen',
          sous_titre: 'onze lacets, belvédère de Stigrøra',
          groupe_moment: 'matin',
          contrainte: 'souple',
        },
        {
          heure: '12:30',
          duree_min: 30,
          titre: 'Ferry Eidsdal – Linge',
          sous_titre: 'ancre horaire, ne pas manquer la rotation',
          groupe_moment: 'midi',
          contrainte: 'dure',
          payant: true,
          cout_eur: 22,
        },
        {
          duree_min: 90,
          titre: 'Cascade de Gudbrandsjuvet',
          groupe_moment: 'apres_midi',
          contrainte: 'souple',
        },
      ],
      confort: {
        laverie: true,
        laverie_jours_depuis: 4,
        laverie_jours_avant: 0,
        streak_autonomie: 0,
        alerte_ppc: false,
        type_nuit: 'camping',
        cout_nuit_eur: 41,
      },
    },
  ],
};

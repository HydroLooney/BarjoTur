import type { ProfilModeVue } from '@/lib/queries/profils';

// Profils de déplacement (T038, affichage), hors live. Valeurs ILLUSTRATIVES tant que le service n'expose pas
// les vrais `routing_params` (R1 : ne pas les faire passer pour des données réelles). Elles disent la FORME de
// l'écran (van gelé, valeur + recommandée + raison en clair), pas la vérité de calcul (qui vit côté A/B).
export const profilsDemo: ProfilModeVue[] = [
  {
    mode: 'van',
    gele: true,
    gelePar: 'réservation du van, cran « Le van »',
    params: [
      {
        cle: 'poids_max_t',
        valeur: 3.5,
        valeur_recommandee: 3.5,
        source: 'defaut',
        justification: 'Van ≤ 3,5 t : évite les routes interdites aux poids lourds (illustratif).',
        domaine: 'Profil van',
      },
      {
        cle: 'peages_bomstasjon',
        valeur: 'inclus',
        valeur_recommandee: 'inclus',
        source: 'calcul',
        justification: 'Péages norvégiens (bomstasjon) comptés pour un van chargé (illustratif).',
        domaine: 'Profil van',
      },
    ],
  },
  {
    mode: 'pieton',
    gele: false,
    params: [
      {
        cle: 'vitesse_marche_kmh',
        valeur: 4.5,
        valeur_recommandee: 4.5,
        source: 'defaut',
        justification: 'Allure de marche moyenne en ville et sur sentier facile (illustratif).',
        domaine: 'Profil piéton',
      },
    ],
  },
  {
    mode: 'rando',
    gele: false,
    params: [
      {
        cle: 'modele_effort',
        valeur: 'Tobler pente-dépendante',
        valeur_recommandee: 'Tobler pente-dépendante',
        source: 'calcul',
        justification: 'Le temps de marche dépend de la pente, pas que de la distance (illustratif).',
        domaine: 'Profil rando',
      },
      {
        cle: 'allure_famille',
        valeur: 'bons marcheurs',
        valeur_recommandee: 'bons marcheurs',
        source: 'manuel',
        justification: 'Famille de randonneurs, avec option douce les jours communs (illustratif).',
        domaine: 'Profil rando',
      },
    ],
  },
  {
    mode: 'tc',
    gele: false,
    params: [
      {
        cle: 'source_horaires',
        valeur: 'Entur (national)',
        valeur_recommandee: 'Entur (national)',
        source: 'calcul',
        justification: 'Arrêts, lignes et fenêtres horaires depuis la base nationale norvégienne (illustratif).',
        domaine: 'Profil transports',
      },
    ],
  },
];

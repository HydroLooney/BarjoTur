import type { Circuit } from '@barjotur/shared';

// Circuits tout-faits de démonstration (M108 / A23), à la forme de `shared/Circuit`. Valeurs ILLUSTRATIVES (R1)
// inspirées de circuits de guide : elles disent la forme de l'écran (liste filtrable, détail par étapes, source
// guide + page, mode d'origine, « Reprendre ce circuit »). Au flip, la vraie bibliothèque vient des endpoints de
// B (M107) et des données sourcées d'A ; la forme ne bouge pas. Un circuit reste un CANEVAS souple, modifiable.
export const circuitsDemo: Circuit[] = [
  {
    id: 1,
    nom: '24 h autour du Lysefjord',
    source: { guide: 'Lonely Planet Norvège', page: 'p. 212' },
    mode_origine: 'voiture',
    duree: '24h',
    zone: 'Lysefjord',
    etapes: [
      { ordre: 1, nom: 'Preikestolen (rando)', poi_id: 101, duree_min: 300, horaire: '7h30', note: 'Partir tôt pour éviter la foule.' },
      { ordre: 2, nom: 'Baignade à Jørpeland', duree_min: 60, horaire: '14h00' },
      { ordre: 3, nom: 'Nuit en autonomie près du fjord', horaire: '19h00' },
    ],
    conseils: ['Bonnes chaussures', 'Eau et pique-nique'],
  },
  {
    id: 2,
    nom: 'Bergen et les fjords en 3 jours',
    source: { guide: 'Guide du Routard Norvège', page: 'p. 88' },
    mode_origine: 'train',
    duree: 'jours',
    jours: 3,
    zone: 'Vestland',
    etapes: [
      { ordre: 1, nom: 'Bryggen (quartier hanséatique)', poi_id: 102, duree_min: 120 },
      { ordre: 2, nom: 'Train de Flåm', poi_id: 103, duree_min: 120, note: 'Un des plus beaux trajets ferroviaires.' },
      { ordre: 3, nom: 'Croisière Nærøyfjord', duree_min: 150 },
      { ordre: 4, nom: 'Mont Fløyen (funiculaire ou rando)', duree_min: 90 },
    ],
  },
  {
    id: 3,
    nom: 'Kayak sur le Nærøyfjord',
    source: { guide: 'Cicerone Walking in Norway', page: 'p. 140' },
    mode_origine: 'bateau',
    duree: 'journee',
    zone: 'Vestland',
    etapes: [
      { ordre: 1, nom: 'Location et briefing kayak', duree_min: 45, horaire: '9h00' },
      { ordre: 2, nom: 'Kayak dans le fjord étroit', duree_min: 240 },
      { ordre: 3, nom: 'Pause déjeuner sur une plage', duree_min: 60 },
    ],
  },
  {
    id: 4,
    nom: 'Cap sur Trolltunga',
    source: { guide: 'Cicerone Walking in Norway', page: 'p. 156' },
    mode_origine: 'pied',
    duree: 'journee',
    zone: 'Hardanger',
    etapes: [
      { ordre: 1, nom: 'Départ du parking de Skjeggedal', horaire: '6h00' },
      { ordre: 2, nom: 'Montée vers Trolltunga', duree_min: 600, note: 'Longue rando, 28 km A/R.' },
    ],
    conseils: ['Réservé aux bons marcheurs', 'Vérifier la météo'],
  },
];

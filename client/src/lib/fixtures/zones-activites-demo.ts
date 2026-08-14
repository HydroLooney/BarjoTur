import type { ZoneActiviteIdeale } from '@barjotur/shared';

// Activité idéale par zone (M108 / A23), à la forme de `shared/ZoneActiviteIdeale`. Valeurs ILLUSTRATIVES (R1)
// sourcées de guides : « ici, le guide conseille le kayak ; là, la rando ». Le `theme` réutilise la typologie des
// activités (nautique, faune…), ce qui permet de le relier aux envies par thème d'un voyageur. Au flip, données
// réelles d'A ; la forme ne bouge pas.
export const zonesActivitesDemo: ZoneActiviteIdeale[] = [
  {
    zone: 'Lysefjord',
    theme: 'nautique',
    source: { guide: 'Lonely Planet Norvège', page: 'p. 210' },
    note: 'Kayak entre les parois du fjord, au calme le matin.',
  },
  {
    zone: 'Hardanger',
    theme: 'panorama',
    source: { guide: 'Cicerone Walking in Norway', page: 'p. 156' },
    note: 'Les grands points de vue (Trolltunga), pour bons marcheurs.',
  },
  {
    zone: 'Lofoten',
    theme: 'faune',
    source: { guide: 'Guide du Routard Norvège', page: 'p. 340' },
    note: 'Observation des oiseaux de mer et sorties safari.',
  },
  {
    zone: 'Vestland',
    theme: 'patrimoine',
    source: { guide: 'Guide du Routard Norvège', page: 'p. 88' },
    note: 'Bryggen, villages hanséatiques, train de Flåm.',
  },
  {
    zone: 'Sørlandet',
    theme: 'baignade',
    source: { guide: 'Lonely Planet Norvège', page: 'p. 190' },
    note: 'Le sud et ses plages, plus douces pour les enfants.',
  },
];

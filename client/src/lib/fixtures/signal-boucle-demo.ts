import type { SignalBoucle } from '@/lib/signal-boucle';

// Signal de boucle de démonstration (M112). Valeurs ILLUSTRATIVES (R1) : elles disent la forme (bandeau « à toi
// de jouer », pastilles de nouveauté, fil « depuis ta dernière visite »). Au flip, l'état réel vient du serveur
// (qui a proposé/voté quoi depuis mon dernier passage) ; la forme d'écran ne bouge pas.
export const signalBoucleDemo: SignalBoucle = {
  avis_attendus: 2,
  nouveautes: { '/explorer': 2, '/le-trajet': 1 },
  depuis_derniere_visite: [
    'Cécile a proposé 2 lieux',
    '3 nouveaux votes dans la famille',
    'La composition a un peu bougé',
  ],
};

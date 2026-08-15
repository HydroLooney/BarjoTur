import type { Voyageur } from '@barjotur/shared';

// Rôle de la famille pour l'admin des voyageurs (T039), hors live. Le contrat `Voyageur` existe déjà
// (shared/role.ts) ; seuls les endpoints d'admin (lister, régénérer un lien, changer un rôle) restent à
// poser par B. Cette fixture alimente le panneau tant que `VITE_ADMIN_LIVE`/`?admin` est off (flip-ready).
// M184 (R2) : prénoms et codes FICTIFS (Alex/Sam/Léa/Noé/Mika), jamais la famille réelle — les captures de
// l'admin sont ainsi public-safe.
export const voyageursDemo: Voyageur[] = [
  {
    id: 1,
    prenom: 'Alex',
    role: 'organisateur_principal',
    qualification: 'adulte',
    codeLien: 'roadtrip-alex',
    actif: true,
  },
  {
    id: 2,
    prenom: 'Sam',
    role: 'organisateur',
    qualification: 'adulte',
    codeLien: 'roadtrip-sam',
    actif: true,
  },
  {
    id: 3,
    prenom: 'Léa',
    role: 'voyageur',
    qualification: 'adulte',
    codeLien: 'roadtrip-lea',
    actif: true,
  },
  {
    id: 4,
    prenom: 'Noé',
    role: 'voyageur',
    qualification: 'enfant',
    codeLien: 'roadtrip-noe',
    actif: true,
  },
  {
    id: 5,
    prenom: 'Mika',
    role: 'voyageur',
    qualification: 'enfant',
    codeLien: 'roadtrip-mika',
    actif: false,
  },
];

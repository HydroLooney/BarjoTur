import type { Voyageur } from '@barjotur/shared';

// Rôle de la famille pour l'admin des voyageurs (T039), hors live. Le contrat `Voyageur` existe déjà
// (shared/role.ts) ; seuls les endpoints d'admin (lister, régénérer un lien, changer un rôle) restent à
// poser par B. Cette fixture alimente le panneau tant que `VITE_ADMIN_LIVE`/`?admin` est off (flip-ready).
export const voyageursDemo: Voyageur[] = [
  {
    id: 1,
    prenom: 'Guillaume',
    role: 'organisateur_principal',
    qualification: 'adulte',
    codeLien: 'roadtrip-guillaume',
    actif: true,
  },
  {
    id: 2,
    prenom: 'Cécile',
    role: 'organisateur',
    qualification: 'adulte',
    codeLien: 'roadtrip-cecile',
    actif: true,
  },
  {
    id: 3,
    prenom: 'Mamie',
    role: 'voyageur',
    qualification: 'adulte',
    codeLien: 'roadtrip-mamie',
    actif: true,
  },
  {
    id: 4,
    prenom: 'Lou',
    role: 'voyageur',
    qualification: 'enfant',
    codeLien: 'roadtrip-lou',
    actif: true,
  },
  {
    id: 5,
    prenom: 'Nino',
    role: 'voyageur',
    qualification: 'enfant',
    codeLien: 'roadtrip-nino',
    actif: false,
  },
];

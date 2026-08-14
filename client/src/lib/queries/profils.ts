import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Parametre } from '@/lib/queries/parametres';
import type { ModeDeplacement } from '@/lib/libelles';

// Profils de déplacement (T038, AFFICHAGE seul — décision M074). Un profil = les intrants de routage d'un mode
// (van/piéton/rando/TC), en LECTURE : valeur, valeur recommandée, raison en clair. L'ÉDITION est reportée (elle
// couple au recompute et au portail organisateur T027) : on n'invente donc PAS de contrat éditable ni d'endpoint
// d'écriture. On réutilise l'atome `Parametre` existant (aucun type shared à inventer). La vue par mode ci-dessous
// est un simple REGROUPEMENT côté front. Endpoint de lecture à confirmer par B/M ; flip-ready d'ici là.

/** Un mode de déplacement et ses paramètres de routage (vue front, regroupe des `Parametre`). */
export interface ProfilModeVue {
  mode: ModeDeplacement;
  /** Le profil est-il gelé par un fait extérieur (van réservé au cran « Le van », A18) ? */
  gele: boolean;
  /** Ce qui gèle le profil, en clair (ex. « réservation du van, cran Le van »). */
  gelePar?: string;
  params: Parametre[];
}

/** Profils de déplacement en lecture. `actif` (drapeau live) gate l'appel réseau. Endpoint à confirmer B/M. */
export function useProfilsDeplacement(actif: boolean) {
  return useQuery({
    queryKey: ['profils-deplacement'],
    enabled: actif,
    queryFn: () => api.get<ProfilModeVue[]>('/profils-deplacement'),
    staleTime: 60_000,
    retry: 0,
  });
}

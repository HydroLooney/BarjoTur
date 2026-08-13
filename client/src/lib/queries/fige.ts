import { useQuery } from '@tanstack/react-query';
import type { FigeItineraire } from '@barjotur/shared';
import { api } from '@/lib/api';

// Lecture d'un itineraire fige (api.fige_lire cote DB2 : geometrie continue + agenda), source de la
// carte animee. Le chemin REST exact reste a caler avec B (handshake) ; la forme suit le contrat
// shared FigeItineraire. Enabled seulement si un profil est demande (non-bloquant tant que B n'a
// pas expose la route : rien ne l'appelle avec un profil dans l'ossature).
export function useFige(profil: string | null) {
  return useQuery({
    queryKey: ['fige', profil],
    enabled: !!profil,
    queryFn: () => api.get<FigeItineraire>(`/fige/${encodeURIComponent(profil as string)}`),
  });
}

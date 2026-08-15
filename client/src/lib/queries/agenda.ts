import { useQuery } from '@tanstack/react-query';
import type { AgendaVoyage, JourAgenda } from '@barjotur/shared';
import { api } from '@/lib/api';

// Agenda du jour <-> serveur (contrat shared cafb053 ; endpoint B172 : GET /api/agenda/:code, clé = lien voyageur —
// il compose « Mon voyage » pondéré par le profil philo + agenda). Branché sur le `code` du voyageur. Dégradation
// DOUCE : tant que le bff n'expose pas encore la route (ordre de redeploy), l'appel échoue en silence (retry 0) → pas
// de carte du jour, la barre d'animation pilote seule ; dès le bff redéployé, la carte du jour se remplit. R1 : les
// champs non encore produits (theme, sous_titre, payant, confort riche) arrivent en null, le rendu les masque.

/** Lit l'agenda du voyage pour le voyageur porteur du lien. Inerte sans `code` ; 404 toléré avant redeploy bff. */
export function useAgenda(code: string | null) {
  return useQuery({
    queryKey: ['agenda', code],
    enabled: !!code,
    queryFn: () => api.get<AgendaVoyage>(`/agenda/${code}`),
    staleTime: 60_000,
    retry: 0,
  });
}

/** Retrouve le jour demandé dans un agenda (ou null). */
export function jourDeAgenda(agenda: AgendaVoyage | null | undefined, jour: number | null): JourAgenda | null {
  if (!agenda || jour == null) return null;
  return agenda.jours.find((j) => j.jour === jour) ?? null;
}

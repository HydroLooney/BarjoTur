import { useMutation, useQuery } from '@tanstack/react-query';
import type { EtatParcours, TransitionCran, TransitionResult } from '@barjotur/shared';
import { api } from '@/lib/api';

// Fil du parcours serveur (A18 / M046, backend B / M047). Passe-plat de `GET /api/parcours/:voyage_id` et
// `POST /api/parcours/:voyage_id/transition`. Flip-ready : gaté par un drapeau `live` ; hors live le composant
// utilise la fixture + la machine locale (`lib/parcours`). Le PIN transite dans le corps, jamais stocké (A03).
const urlParcours = (voyageId: number) => `/parcours/${voyageId}`;

/** État d'avancement du voyage courant (machine à crans). `actif` (drapeau live) gate l'appel réseau. */
export function useParcoursServeur(voyageId: number, actif: boolean) {
  return useQuery({
    queryKey: ['parcours', voyageId],
    enabled: actif,
    queryFn: () => api.get<EtatParcours>(urlParcours(voyageId)),
    retry: 0,
  });
}

/** Franchir / verrouiller / rouvrir un cran (gaté rôle + PIN côté serveur, idempotent). */
export function useTransitionParcours(voyageId: number) {
  return useMutation({
    mutationFn: (t: TransitionCran) =>
      api.post<TransitionResult>(`${urlParcours(voyageId)}/transition`, t, { idempotent: true }),
  });
}

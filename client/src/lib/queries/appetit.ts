import { useMutation, useQuery } from '@tanstack/react-query';
import type { AppetitThematique } from '@barjotur/shared';
import { api } from '@/lib/api';

// Appétits thématiques d'un voyageur (M092 / M097, route confirmée M129 / B049, migration 009). Donnée PRÉCIEUSE
// (`decision.appetit_thematique`, denylist de la sync), endpoint DÉDIÉ voter-gated (pas la collection générique) :
// `GET /api/appetit/:code` → `AppetitThematique[]`, `PUT /api/appetit/:code` (corps `{theme, appetit}`, idempotent).
// Flip-ready : `actif` (drapeau sync live) gate l'appel réseau ; hors flip, inerte (l'écran « Vos envies par thème »
// reste sur le store local). Le câblage hydratation/push (garde anti-boucle) se fait au flip, BFF up, vérifié.
const urlAppetit = (code: string) => `/appetit/${encodeURIComponent(code)}`;

/** Appétits du voyageur au serveur. `actif` (drapeau sync) gate l'appel ; identité = code_lien (jamais le PIN). */
export function useAppetitServeur(code: string | null, actif: boolean) {
  return useQuery({
    queryKey: ['appetit', code],
    enabled: actif && code !== null,
    queryFn: () => api.get<AppetitThematique[]>(urlAppetit(code as string)),
    retry: 0,
  });
}

/** Écrit un appétit (idempotent, gaté voter côté serveur). Renvoie l'état à jour des appétits du voyageur. */
export function useEcrireAppetit(code: string | null) {
  return useMutation({
    mutationFn: (a: AppetitThematique) => api.put<AppetitThematique[]>(urlAppetit(code ?? ''), a),
  });
}

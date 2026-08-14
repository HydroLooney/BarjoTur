import { useMutation, useQuery } from '@tanstack/react-query';
import type { DemandeRegenererLien, DemandeRole, Voyageur } from '@barjotur/shared';
import { api } from '@/lib/api';

// Admin des voyageurs (T039) : l'organisateur liste la famille, régénère un lien perso, change un rôle.
// Contrats posés par M dans shared/role.ts (M076) : `Voyageur`, `DemandeRole`, `DemandeRegenererLien` (PIN
// requis, vérifié côté serveur). Endpoints posés par B (B041), route confirmée par M (M080) : le `code` du
// DEMANDEUR passe dans le PATH (`/voyageurs/:voyage_id/:code/…`), convention `/app/<code>/` déjà utilisée par
// `/exploration/:code`. B s'en sert pour identifier qui demande (`peut(role,…)` + `verifier_pin(code, pin)`).
// Flip-ready : `actif` gate l'appel réseau ; hors live, le composant sert la fixture. Le PIN transite dans le
// corps, jamais stocké (A03).
const base = (voyageId: number, code: string) => `/voyageurs/${voyageId}/${encodeURIComponent(code)}`;

/** Rôle des voyageurs d'un voyage (organisateur seulement côté serveur). `actif` gate l'appel réseau. */
export function useVoyageurs(voyageId: number, code: string | null, actif: boolean) {
  return useQuery({
    queryKey: ['voyageurs', voyageId, code],
    enabled: actif && code !== null,
    queryFn: () => api.get<Voyageur[]>(base(voyageId, code as string)),
    retry: 0,
  });
}

/** Changer le rôle d'un voyageur (gaté rôle + PIN côté serveur). Renvoie le voyageur mis à jour. */
export function useChangerRole(voyageId: number, code: string | null) {
  return useMutation({
    mutationFn: (d: DemandeRole) =>
      api.put<Voyageur>(`${base(voyageId, code ?? '')}/${d.membre_id}/role`, d),
  });
}

/** Régénérer le lien perso d'un voyageur (l'ancien devient caduc). Renvoie le voyageur au nouveau codeLien. */
export function useRegenererLien(voyageId: number, code: string | null) {
  return useMutation({
    mutationFn: (d: DemandeRegenererLien) =>
      api.post<Voyageur>(`${base(voyageId, code ?? '')}/${d.membre_id}/regenerer-lien`, d, { idempotent: true }),
  });
}

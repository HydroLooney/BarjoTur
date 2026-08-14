import { useMutation, useQuery } from '@tanstack/react-query';
import type { Role, Voyageur } from '@barjotur/shared';
import { api } from '@/lib/api';

// Admin des voyageurs (T039) : l'organisateur liste la famille, régénère un lien perso, change un rôle.
// Le contrat `Voyageur` existe (shared/role.ts) ; les ENDPOINTS ci-dessous restent à poser par B (remontés
// à M/B). Flip-ready : `actif` (drapeau live) gate l'appel réseau ; hors live, le composant sert la fixture.
// Autorité serveur (A03) : le PIN transite dans le corps, jamais stocké ; le rôle envoyé est vérifié côté B.
const base = (voyageId: number) => `/voyageurs/${voyageId}`;

/** Corps d'une demande de changement de rôle. Shape provisoire À CONFIRMER par B (pas de type shared encore). */
export interface DemandeRole {
  membre_id: number;
  role: Role;
  pin?: string;
}

/** Corps d'une régénération de lien. Shape provisoire À CONFIRMER par B. Le lien n'est réémis qu'à la demande. */
export interface DemandeRegenererLien {
  membre_id: number;
  pin?: string;
}

/** Rôle des voyageurs d'un voyage (organisateur seulement côté serveur). `actif` gate l'appel réseau. */
export function useVoyageurs(voyageId: number, actif: boolean) {
  return useQuery({
    queryKey: ['voyageurs', voyageId],
    enabled: actif,
    queryFn: () => api.get<Voyageur[]>(base(voyageId)),
    retry: 0,
  });
}

/** Changer le rôle d'un voyageur (gaté rôle + PIN côté serveur). Renvoie le voyageur mis à jour. */
export function useChangerRole(voyageId: number) {
  return useMutation({
    mutationFn: (d: DemandeRole) => api.put<Voyageur>(`${base(voyageId)}/${d.membre_id}/role`, d),
  });
}

/** Régénérer le lien perso d'un voyageur (l'ancien devient caduc). Renvoie le voyageur au nouveau codeLien. */
export function useRegenererLien(voyageId: number) {
  return useMutation({
    mutationFn: (d: DemandeRegenererLien) =>
      api.post<Voyageur>(`${base(voyageId)}/${d.membre_id}/regenerer-lien`, d, { idempotent: true }),
  });
}

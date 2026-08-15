import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  DemandeGenererLien,
  DemandeRegenererLien,
  DemandeRevoquerLien,
  DemandeRole,
  LienGenere,
  Voyageur,
} from '@barjotur/shared';
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

// Liens de partage à PORTÉE (T057 / M199, contrat `@barjotur/shared` f9e5fda) : l'organisateur génère un lien
// Membre / Suggestion / Vitrine (votesComptent + espaces visibles portés par la portée) et peut le révoquer.
// Route : le code du DEMANDEUR (organisateur) reste dans le PATH (convention `base`, comme le reste de l'admin) ;
// la cible à révoquer voyage dans le corps (`DemandeRevoquerLien.code`). PIN vérifié serveur, jamais stocké (A03/R2).

/** Générer un lien de partage à portée. Renvoie `LienGenere` (voyageur + portée effective + votesComptent). */
export function useGenererLien(voyageId: number, code: string | null) {
  return useMutation({
    mutationFn: (d: DemandeGenererLien) => api.post<LienGenere>(`${base(voyageId, code ?? '')}/lien`, d),
  });
}

/** Révoquer un lien (le code cible meurt). Idempotent : révoquer deux fois ne casse rien. */
export function useRevoquerLien(voyageId: number, code: string | null) {
  return useMutation({
    mutationFn: (d: DemandeRevoquerLien) =>
      api.post<{ ok: true }>(`${base(voyageId, code ?? '')}/revoquer`, d, { idempotent: true }),
  });
}

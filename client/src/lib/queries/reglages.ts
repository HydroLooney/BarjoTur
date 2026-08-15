import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DemandeEcrireReglage, FamilleReglage, Reglage, ValeurReglage } from '@barjotur/shared';
import { api } from '@/lib/api';
import { useIdentite } from '@/stores/identite';

// Registre des REGLAGES experts (composition / conduite / profils / medical), servi par B sur `budget.parametre`
// (B112/B131). GET /api/reglages/:famille est OUVERT : C affiche TOUT et VERROUILLE selon la capacite (l'ecriture
// PUT /api/reglages/:code/:famille est gatee capacite + PIN cote serveur, autorite B). Frontiere reseau unique :
// aucun composant ne parle a fetch, tout passe par la couche query.

/** Les quatre familles de reglages du contrat (source unique shared). */
export const FAMILLES_REGLAGE: FamilleReglage[] = ['conduite', 'composition', 'profils', 'medical'];

/** Lit une famille de reglages. Pas de crash si le BFF n'est pas branche (retour vide, degrade propre). */
export function useReglages(famille: FamilleReglage) {
  return useQuery({
    queryKey: ['reglages', famille],
    queryFn: () => api.get<Reglage[]>(`/reglages/${famille}`),
    staleTime: 60_000,
    retry: 0,
  });
}

/** Lit toutes les familles en parallele (pour l'ecran Regler global). */
export function useTousReglages() {
  const conduite = useReglages('conduite');
  const composition = useReglages('composition');
  const profils = useReglages('profils');
  const medical = useReglages('medical');
  const requetes = [conduite, composition, profils, medical];
  return {
    reglages: requetes.flatMap((r) => r.data ?? []),
    isLoading: requetes.some((r) => r.isLoading),
    isError: requetes.every((r) => r.isError),
    vide: requetes.every((r) => (r.data ?? []).length === 0),
  };
}

/**
 * Ecrit un reglage (PUT /api/reglages/:code/:famille). Le PIN transite dans le corps, JAMAIS stocke cote client
 * (A03) ; le serveur revoit la capacite et le PIN avant d'ecrire. Invalide le cache de la famille au succes.
 */
export function useEcrireReglage(famille: FamilleReglage) {
  const code = useIdentite((s) => s.code);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (corps: DemandeEcrireReglage) => {
      if (!code) throw new Error('Aucun lien perso : impossible d’ecrire un reglage.');
      return api.put<Reglage>(`/reglages/${code}/${famille}`, corps);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reglages', famille] });
    },
  });
}

/** Coerce une valeur de reglage (le BFF renvoie les nombres en chaine) vers un nombre exploitable par un curseur. */
export function nombreReglage(v: ValeurReglage): number {
  return typeof v === 'number' ? v : Number(v);
}

/** Un reglage est numerique (curseur + saisie) s'il porte des bornes chiffrees. */
export function estReglageNumerique(r: Reglage): boolean {
  return r.bornes != null && (r.bornes.min != null || r.bornes.max != null);
}

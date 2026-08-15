import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PhilosophieReponse, PhilosophieMajInput, CurseurCatalogue, EnvieCatalogue } from '@barjotur/shared';
import { api } from '@/lib/api';
import { fusionnerCatalogue, completerProfil, profilDefaut } from '@/lib/philosophie';

// Profil voyageur <-> serveur (M508, endpoints LIVE B166/B169) : GET/PUT /api/philosophie/:code. Le serveur est la
// SEULE vérité (DB2, versionné) ; le catalogue de libellés vient de lui (A159), fusionné sur le secours local pour ne
// jamais afficher un écran nu. Modèle NATIF [0..1] (curseurs + envies + cap_nord) : aucune conversion, le store, la
// route et l'UI parlent la même échelle. Écriture gatée capacité `voter` côté serveur ; ici partiel accepté.

export interface CataloguePhilo {
  curseurs: CurseurCatalogue[];
  envies: EnvieCatalogue[];
}

/**
 * Lit le catalogue + le profil du voyageur. Toujours utile : sans `code` (ou avant réponse) on rend le catalogue de
 * SECOURS + un profil par défaut, pour que l'écran soit lisible et jouable hors ligne. Retry 0 (famille, pas d'attente).
 */
export function usePhilosophieProfil(code: string | null) {
  return useQuery({
    queryKey: ['philosophie', code],
    enabled: !!code,
    queryFn: () => api.get<PhilosophieReponse>(`/philosophie/${code}`),
    staleTime: 60_000,
    retry: 0,
    select: (rep) => ({
      catalogue: fusionnerCatalogue(rep.catalogue),
      profil: completerProfil(rep.profil),
      version: rep.version,
    }),
  });
}

/** Écrit le profil (partiel { curseurs?, envies?, cap_nord? }). PUT idempotent ; invalide la lecture au succès. */
export function useEcrirePhilosophieProfil(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (maj: PhilosophieMajInput) => {
      if (!code) throw new Error('Aucun lien perso : profil non enregistré.');
      return api.put(`/philosophie/${code}`, maj);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['philosophie', code] });
    },
  });
}

/** Catalogue + profil de secours, pour l'affichage tant que le serveur n'a pas répondu (ou sans lien). */
export function philoSecours(): { catalogue: CataloguePhilo; profil: ReturnType<typeof profilDefaut> } {
  return { catalogue: fusionnerCatalogue(), profil: profilDefaut() };
}

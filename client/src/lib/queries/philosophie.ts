import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AXES_PHILO } from '@/lib/philosophie';

// Profil philosophie <-> serveur (B154, contrat confirmé) : GET/PUT /api/philosophie/:code, axes 0-1 normalisés
// (défaut 0.5). Le store front travaille en 0-100 (sliders) → on convertit à la frontière. Ces 8 axes pilotent la
// signature du composeur (mapping côté BFF, R1). FLIP-READY : gaté tant que l'endpoint n'est pas live (VITE_PHILO_LIVE
// / ?philo) ; inerte et sans crash avant. Au flip, on hydrate le store depuis le serveur et on pousse à chaque réglage.

interface ProfilPhiloServeur {
  axes: Record<string, number>; // 0-1
}

const PHILO_LIVE =
  import.meta.env.VITE_PHILO_LIVE === '1' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('philo'));

/** 0-100 (store) → 0-1 (serveur), clampé, sur les 8 axes connus. */
export function axes100Vers01(v100: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    AXES_PHILO.map((a) => [a.cle, Math.min(1, Math.max(0, (v100[a.cle] ?? 50) / 100))]),
  );
}

/** 0-1 (serveur) → 0-100 (store) sur les 8 axes. */
export function axes01Vers100(v01: Record<string, number>): Record<string, number> {
  return Object.fromEntries(AXES_PHILO.map((a) => [a.cle, Math.round((v01[a.cle] ?? 0.5) * 100)]));
}

/** Lit le profil du voyageur (0-100 pour le store). Inerte tant que le drapeau live est off. */
export function useProfilPhilo(code: string | null) {
  return useQuery({
    queryKey: ['philosophie', code],
    enabled: PHILO_LIVE && !!code,
    queryFn: async () => {
      const rep = await api.get<ProfilPhiloServeur>(`/philosophie/${code}`);
      return axes01Vers100(rep.axes ?? {});
    },
    staleTime: 60_000,
    retry: 0,
  });
}

/** Écrit le profil (le store envoie du 0-100, on convertit en 0-1). PUT idempotent côté route. */
export function useEcrireProfilPhilo(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (valeurs100: Record<string, number>) => {
      if (!code) throw new Error('Aucun lien perso : profil non enregistré.');
      return api.put(`/philosophie/${code}`, { axes: axes100Vers01(valeurs100) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['philosophie', code] });
    },
  });
}

export const philoLive = PHILO_LIVE;

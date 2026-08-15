import { useQuery } from '@tanstack/react-query';
import type { VarianteLiaison } from '@barjotur/shared';
import { api } from '@/lib/api';

// Bi-critère d'une liaison base→base (B070, contrat M173) : GET /api/liaison/:de/:vers/variantes → { front, defaut }.
// C l'AFFICHE (ArbitrageLiaison : « par le ferry 1 h / 30 € » vs « par la route 2 h 10 / gratuit »), B en fait
// autorité, A produit les variantes. Chargé À LA DEMANDE (quand l'utilisateur ouvre une liaison), jamais en masse.
// Dégradation propre côté B (RPC absente → front vide, pas de 500). Flip-ready : `VITE_LIAISON_LIVE=1`, ou `?liaison`
// en DEV pour tester sans rebuild ; hors flip, l'écran reste sur la fixture de démo (`variantesLiaisonDemo`).

/**
 * Réponse de l'endpoint variantes. PROVISOIRE côté C (front de Pareto + variante par défaut) : pas encore d'alias
 * dans `@barjotur/shared` — À REMONTER dans shared/ par M/B au flip (je ne modifie pas shared/). `defaut` peut être
 * null si aucune variante n'est disponible (liaison sans routage, dégradation propre).
 */
export interface VariantesLiaisonResult {
  front: VarianteLiaison[];
  defaut: VarianteLiaison | null;
}

const LIAISON_LIVE_ENV = import.meta.env.VITE_LIAISON_LIVE === '1';

function liaisonLive(): boolean {
  if (LIAISON_LIVE_ENV) return true;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).has('liaison');
  }
  return false;
}

/**
 * Variantes d'une liaison base→base, à la demande. `de`/`vers` = identifiants de base ; l'appel n'est émis que
 * lorsque les deux sont connus ET que le drapeau live est posé (sinon l'UI reste sur la fixture). `retry: 0` :
 * une liaison sans variante n'est pas une panne à réessayer.
 */
export function useVariantesLiaison(de: number | null, vers: number | null) {
  const actif = liaisonLive() && de !== null && vers !== null;
  return useQuery({
    queryKey: ['liaison', de, vers],
    enabled: actif,
    queryFn: () => api.get<VariantesLiaisonResult>(`/liaison/${de}/${vers}/variantes`),
    retry: 0,
  });
}

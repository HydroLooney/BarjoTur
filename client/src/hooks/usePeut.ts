import type { Capacite } from '@barjotur/shared';
import { peut } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';

// Rendu conditionnel par capacité (T043 / A03 / M076). Source UNIQUE : la carte partagée `peut()` de shared,
// EXACTEMENT celle que le serveur applique en autorité. Le client MONTRE ou MASQUE, il ne réinvente aucune
// règle (pas de dérive front/back). Masquer n'est pas sécuriser : B refuse toujours la mutation interdite.
// Pas d'identité résolue (visiteur sans lien perso) = aucune capacité, comme un invité.
export function usePeut(capacite: Capacite): boolean {
  const role = useIdentite((s) => s.role);
  const qualification = useIdentite((s) => s.qualification);
  if (!role) return false;
  return peut(role, capacite, qualification);
}

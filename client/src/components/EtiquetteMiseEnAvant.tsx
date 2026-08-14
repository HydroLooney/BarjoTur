import { Badge } from '@/ui/primitives/badge';
import {
  LIBELLE_MISE_EN_AVANT,
  VARIANTE_MISE_EN_AVANT,
  miseEnAvantDeScore,
  type MiseEnAvant,
} from '@/lib/mise-en-avant';

// Étiquette de mise en avant d'un lieu (A24 / M110) : « Vaut le voyage / le détour / Au passage », rien en
// dessous. Se pose sur une fiche, une carte, une liste. On peut lui donner soit un `score` (elle en dérive le
// niveau), soit un `niveau` déjà connu (fixtures, suggestions au passage). Rien à afficher = rien de rendu.
export function EtiquetteMiseEnAvant({
  score,
  niveau,
}: {
  score?: number | null;
  niveau?: MiseEnAvant | null;
}) {
  const n = niveau ?? miseEnAvantDeScore(score);
  if (!n) return null;
  return <Badge variant={VARIANTE_MISE_EN_AVANT[n]}>{LIBELLE_MISE_EN_AVANT[n]}</Badge>;
}

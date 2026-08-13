import type { FigeDetail } from '@barjotur/shared';
import type { EtapeEntree } from '@/lib/anim-trajet';

// Convertit les etapes d'un fige riche en entrees d'animation (marqueurs de nuitee projetes sur le trace).
// La coordonnee d'une etape = son aire de nuitee (aire_lon/aire_lat) quand elle est connue ; sinon null
// (l'animation la projette alors sur le point du trace le plus proche, ou la place au mieux).
export function etapesDepuisFige(detail: FigeDetail): EtapeEntree[] {
  return detail.etapes.map((e) => ({
    ordre: e.jour,
    nom: e.nuitee_type ?? `Jour ${e.jour}`,
    nuits: 1,
    date: e.date_jour,
    type: e.nuitee_type ?? undefined,
    coord: e.aire_lon != null && e.aire_lat != null ? [e.aire_lon, e.aire_lat] : null,
  }));
}

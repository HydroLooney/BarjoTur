import type { CataloguePoi } from '@barjotur/shared';

// Groupement par zone (SPEC-CONSOLIDEE §A, audit Explorer) : on ne pose JAMAIS une liste plate de plus de
// SEUIL_LISTE_PLATE items. Au-delà, on regroupe par zone (le `region` du POI) pour que l'œil s'oriente au lieu
// de scroller à plat. L'ordre d'arrivée des POI est préservé DANS chaque zone (le tri « recommandé » amont tient).

/** Au-delà de ce nombre d'items, on groupe par zone plutôt que d'afficher une liste plate. */
export const SEUIL_LISTE_PLATE = 20;

/** Libellé de la zone des POI sans `region` renseignée. */
export const ZONE_SANS = 'Ailleurs';

export interface GroupeZone {
  zone: string;
  pois: CataloguePoi[];
}

/**
 * Regroupe les POI par zone (`region`), zones triées alphabétiquement, `Ailleurs` (sans region) en dernier.
 * L'ordre des POI dans une zone suit l'ordre d'entrée (tri amont préservé).
 */
export function grouperParZone(pois: CataloguePoi[]): GroupeZone[] {
  const parZone = new Map<string, CataloguePoi[]>();
  for (const p of pois) {
    const zone = p.region ?? ZONE_SANS;
    const bucket = parZone.get(zone);
    if (bucket) bucket.push(p);
    else parZone.set(zone, [p]);
  }
  return [...parZone.entries()]
    .map(([zone, list]) => ({ zone, pois: list }))
    .sort((a, b) => {
      if (a.zone === ZONE_SANS) return 1;
      if (b.zone === ZONE_SANS) return -1;
      return a.zone.localeCompare(b.zone, 'fr');
    });
}

/** Vrai si la liste doit être groupée par zone (au-delà du seuil de liste plate). */
export function doitGrouper(pois: CataloguePoi[]): boolean {
  return pois.length > SEUIL_LISTE_PLATE;
}

import { useMemo } from 'react';
import type { Feature, Geometry } from 'geojson';
import { charte } from '@/ui/theme';
import { useCartoData } from '@/lib/carto-source';
import { bboxDeFeatures, type Bornes } from '@/lib/carte-cadrage';

// Source unique de la SYMBOLOGIE de découpage, partagée par la coulisses (diagnostic) et la carte de l'app
// (contexte) → cohérence carte↔coulisses (exigence M). Ici : palette, motifs de tireté, chargement + découpe
// des niveaux. Chaque carte décide ensuite de ses opacités/paliers (diagnostic plein vs contexte estompé).
// Le découpage est un jeu TUILÉ en cible (Martin MVT, M369) ; en dev il passe par la couche source (GeoJSON static).

// LIBELLÉS DES NIVEAUX du découpage — FIGÉS par Guillaume (M388) : niveau1 = « Région » (4, landsdel), niveau2 =
// « District » (22, secteurs projet), niveau3 = « Paysage » (147, landskapsregion NIBIO ∩ secteur, nom in extenso R1).
// SOURCE UNIQUE consommée par le fil d'ariane (carte + fiche) : les VALEURS sont les `nom_affichage`, ces libellés sont
// les mots de NIVEAU. Clé = `niveau` de la donnée ('region'|'zone'|'sous_zone').
export const LIBELLES_NIVEAUX_DECOUPAGE: Record<string, string> = {
  region: 'Région',
  zone: 'District',
  sous_zone: 'Paysage',
};
export const libelleNiveau = (niveau: string): string => LIBELLES_NIVEAUX_DECOUPAGE[niveau] ?? niveau;

// Sur fond papier chaud, on mène par le FRAIS (leçon carto validée M235) : glacier, vert, puis chaud franc.
export const TOKENS_REGION = ['--glacier', '--vert', '--espace-mes-envies', '--ocre'];
export const REPLI_REGION = '--glacier';
export const tokenRegion = (i: number): string => TOKENS_REGION[i % TOKENS_REGION.length] ?? REPLI_REGION;

// Contours PLEINS depuis la vraie géométrie administrative (A079/M247) : régions disjointes, plus besoin de tireté
// « enveloppe » (les contours ne se croisent plus).

/** Expression `match` id de région → sa teinte (résolue au thème courant). À mémoïser avec [regions, theme]. */
export function couleurRegionExpr(regions: Feature<Geometry>[]): string {
  const ids = regions.map((f) => String(f.properties?.id ?? ''));
  const paires = ids.flatMap((id, i) => [id, charte(tokenRegion(i))]);
  return ['match', ['get', 'id'], ...paires, charte(REPLI_REGION)] as unknown as string;
}

export interface Decoupage {
  regions: Feature<Geometry>[];
  zones: Feature<Geometry>[];
  sousZones: Feature<Geometry>[];
  /** Emprise régions + zones (pour le cadrage ; les bases isolées au nord sont exclues). */
  bornes: Bornes | null;
  isLoading: boolean;
  isError: boolean;
}

/** Charge le découpage réel (statique, react-query) et le découpe par niveau. Partagé coulisses / Explorer. */
export function useDecoupageData(actif = true): Decoupage {
  const q = useCartoData('decoupage', actif);
  return useMemo(() => {
    const feats = (q.data?.features ?? []) as Feature<Geometry>[];
    const par = (n: string) => feats.filter((f) => f.properties?.niveau === n);
    const regions = par('region');
    const zones = par('zone');
    return {
      regions,
      zones,
      sousZones: par('sous_zone'),
      bornes: bboxDeFeatures([...regions, ...zones]),
      isLoading: q.isLoading,
      isError: q.isError,
    };
  }, [q.data, q.isLoading, q.isError]);
}

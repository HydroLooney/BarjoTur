// Service carto (M272 §3) : passe-plats « prêts-à-câbler » des vues de diffusion v3 (contrat B088/M263). LECTURE seule.
// Le BFF sert des MÉTADONNÉES légères (légende des calques, hiérarchie de découpage) ; Martin sert la géométrie (tuiles
// MVT, lecture directe des vues). RPC injectée (défaut appelerRpc) pour l'e2e sur fixtures. Les vues arrivent d'A en
// Passe 2 : tant qu'elles n'existent pas, la RPC lève 42883 et on rend 200 vide (siRpcAbsente) — se câble tout seul à la
// livraison. Ne connaît pas Express.

import { appelerRpc, argTexte, siRpcAbsente } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { FeatureCollection } from '../domain/poi.js';
import type {
  CalqueBucket,
  EntreeDecoupage,
  NiveauDecoupage,
  DifficulteSentier,
  CircuitWeb,
  BaseWeb,
} from '../domain/carto.js';

const NIVEAUX: readonly NiveauDecoupage[] = ['region', 'zone', 'sous_zone'];

/** Valide le filtre `niveau` (query) : region|zone|sous_zone, ou undefined si absent. Non-string ou hors énumération =
 *  400. Pure, testable sans DB. */
export function validerNiveau(query: unknown): NiveauDecoupage | undefined {
  const q = (typeof query === 'object' && query !== null ? query : {}) as Record<string, unknown>;
  if (q.niveau === undefined) return undefined;
  if (typeof q.niveau !== 'string' || !(NIVEAUX as readonly string[]).includes(q.niveau)) {
    throw Erreurs.requeteInvalide(`Niveau de découpage inconnu : ${String(q.niveau)}. Attendu region|zone|sous_zone.`);
  }
  return q.niveau as NiveauDecoupage;
}

/** Légende/filtre des calques : buckets `categorie_calque` + effectifs. Passe-plat de api.carto_calques. Vide si la vue
 *  n'est pas encore livrée (Passe 2). */
export async function lireCalques(rpc = appelerRpc): Promise<CalqueBucket[]> {
  const res = await siRpcAbsente(rpc<CalqueBucket[] | null>('carto_calques', []), null);
  return res ?? [];
}

/** Hiérarchie de découpage (niveau/id/parent_id/n_poi), filtrable par niveau. Passe-plat de api.carto_decoupage. */
export async function lireDecoupage(
  niveau: NiveauDecoupage | undefined,
  rpc = appelerRpc,
): Promise<EntreeDecoupage[]> {
  const res = await siRpcAbsente(rpc<EntreeDecoupage[] | null>('carto_decoupage', [argTexte(niveau ?? null)]), null);
  return res ?? [];
}

/** Légende sentiers : buckets de difficulté + effectifs (facile|moyen|difficile|expert|non_grade). Passe-plat de
 *  api.carto_sentiers_difficultes. Vide tant que la vue v_web_sentiers n'est pas livrée (Passe 2). */
export async function lireSentiersDifficultes(rpc = appelerRpc): Promise<DifficulteSentier[]> {
  const res = await siRpcAbsente(rpc<DifficulteSentier[] | null>('carto_sentiers_difficultes', []), null);
  return res ?? [];
}

/** Circuits carto (métadonnées ; géométrie via Martin). Passe-plat de api.carto_circuits. */
export async function lireCircuitsCarto(rpc = appelerRpc): Promise<CircuitWeb[]> {
  const res = await siRpcAbsente(rpc<CircuitWeb[] | null>('carto_circuits', []), null);
  return res ?? [];
}

/** Bases carto (points de nuit ; géométrie via Martin). Passe-plat de api.carto_bases. */
export async function lireBasesCarto(rpc = appelerRpc): Promise<BaseWeb[]> {
  const res = await siRpcAbsente(rpc<BaseWeb[] | null>('carto_bases', []), null);
  return res ?? [];
}

// --- Couches GeoJSON (M367 : carto servie par endpoints DB2, plus de statique) ---
// Chaque couche = une FeatureCollection GeoJSON lue d'une vue diffusion (ST_AsGeoJSON côté RPC). Dégradation : vue/RPC
// absente (dev pré-Passe 2) → FeatureCollection VIDE (le client voit la MÊME forme de production ; zéro re-câblage au flip).

/** FeatureCollection vide (dégradation : le client garde le contrat de production). */
const FC_VIDE: FeatureCollection = { type: 'FeatureCollection', features: [] };

async function lireCoucheGeojson(
  rpcName: 'carto_poi_geojson' | 'carto_decoupage_geojson' | 'carto_services_van_geojson' | 'carto_routes_sceniques_geojson' | 'carto_sentiers_geojson' | 'carto_circuits_geojson' | 'carto_bases_geojson',
  rpc: typeof appelerRpc,
): Promise<FeatureCollection> {
  const res = await siRpcAbsente(rpc<FeatureCollection | null>(rpcName, []), null);
  return res ?? FC_VIDE;
}

/** POI carto en GeoJSON (v_web_poi : geom + tier, confiance, votable, categorie_calque, sous_zone_id, nom_affichage…). */
export const lireCartoPoiGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_poi_geojson', rpc);
/** Découpage (régions/zones/sous-zones) en GeoJSON (v_web_decoupage : geom + niveau, id, parent_id, couverte_par…). */
export const lireCartoDecoupageGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_decoupage_geojson', rpc);
/** Services van (aires/bobil/laverie/élec) en GeoJSON (v_web_poi_services_van). */
export const lireCartoServicesVanGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_services_van_geojson', rpc);
/** Routes scéniques en GeoJSON (v_web_routes_sceniques). */
export const lireCartoRoutesSceniquesGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_routes_sceniques_geojson', rpc);
/** Sentiers en GeoJSON (v_web_sentiers : geom + difficulte, surface, saison, length_m). */
export const lireCartoSentiersGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_sentiers_geojson', rpc);
/** Circuits en GeoJSON (v_web_circuits, M410). Vue livrée au dump final → d'ici là FC vide (dégradation), C retire son statique. */
export const lireCartoCircuitsGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_circuits_geojson', rpc);
/** Bases idéales en GeoJSON (v_web_bases_ideales, M410 ; ré-optimisées au dump final). D'ici là FC vide (dégradation). */
export const lireCartoBasesGeojson = (rpc = appelerRpc): Promise<FeatureCollection> => lireCoucheGeojson('carto_bases_geojson', rpc);

import { useGeojsonPublic } from '@/lib/geojson-public';

// Couche SOURCE de la carto (M368/M369/M406). Cible = « tout DB2, zéro statique » : couches tuilées → MARTIN MVT,
// POI → GeoJSON endpoint BFF. B a livré la stack de DEV sur donnée RÉELLE (B119) : Martin http://localhost:8003,
// endpoints POI GeoJSON http://localhost:8099/api/carto/*. On bascule dessus (fini les statiques + le rate-limit
// OpenTopoMap). Au Go Live final, même montage sur prod DB2 → zéro re-câblage (seule la base d'URL change).

// Bascule globale. 'endpoint' = données réelles via Martin/BFF (B119) ; 'statique' = anciens assets public/data (repli).
const SOURCE: 'statique' | 'endpoint' = 'endpoint';

// Bases d'URL carto, pilotées par env pour ne JAMAIS coder en dur un localhost dans le build prod (C162, B145).
// En PROD, défaut SAME-ORIGIN derrière le reverse-proxy de la stack v3 (comme `/api` dans api.ts) : `/api/carto`
// pour le GeoJSON BFF, `/tiles` pour les tuiles Martin (MVT). En DEV, on garde la stack locale de B (B119). B peut
// surcharger l'un ou l'autre par `VITE_CARTO_BFF` / `VITE_MARTIN` au montage de la stack (subdomain, CDN…). Le
// navigateur du visiteur ne connaît ainsi qu'une seule origine (voyage.barjot.net), zéro CORS, zéro hostname figé.
const BFF = import.meta.env.VITE_CARTO_BFF ?? (import.meta.env.DEV ? 'http://localhost:8099/api/carto' : '/api/carto');
const MARTIN = import.meta.env.VITE_MARTIN ?? (import.meta.env.DEV ? 'http://localhost:8003' : '/tiles');

type Nature = 'tuile' | 'geojson';

const JEUX = {
  // POI (767) → GeoJSON endpoint (clustering C13 + drill-down C15 côté client). Enveloppe {ok,data} dé-emballée en amont.
  poi: { nature: 'geojson', statique: '/data/coulisses/poi.geojson', endpoint: `${BFF}/poi` },
  // Découpage (173) → GeoJSON endpoint (petit ; les aplats/labels restent des sources geojson côté rendu).
  decoupage: { nature: 'geojson', statique: '/data/coulisses/decoupage.geojson', endpoint: `${BFF}/decoupage-geo` },
  // Sentiers (139 241) → TUILES Martin (jamais en GeoJSON, poids). Consommé par une source `vector`, pas par useCartoData.
  sentiers: { nature: 'tuile', statique: '/data/coulisses/sentiers.geojson', endpoint: `${MARTIN}/v_web_sentiers` },
  routesSceniques: { nature: 'geojson', statique: '/data/coulisses/routes-sceniques.geojson', endpoint: `${BFF}/routes-sceniques` },
  servicesVan: { nature: 'geojson', statique: '/data/coulisses/services-van.geojson', endpoint: `${BFF}/services-van` },
  // Circuits + bases : exposés en GeoJSON par le BFF (B123, endpoints `-geo`) → DERNIERS statiques retirés. Vides en dev
  // (FeatureCollection []), se remplissent au dump final (vues ré-optimisées), zéro re-câblage. NB circuits = LineString.
  circuits: { nature: 'geojson', statique: '/data/coulisses/circuits.geojson', endpoint: `${BFF}/circuits-geo` },
  bases: { nature: 'geojson', statique: '/data/coulisses/bases_ideales.geojson', endpoint: `${BFF}/bases-geo` },
  // Bases idéales (18 points de nuit) → TUILES Martin `v_web_bases_ideales` (B135). Le GeoJSON `/bases-geo` est vide
  // sur le dump dev ; les tuiles portent la donnée réelle (base_id, nom, rang, rayonnement, structurante…). Consommé
  // par une source `vector` (comme les sentiers), pas par useCartoData.
  basesTuiles: { nature: 'tuile', statique: '/data/coulisses/bases_ideales.geojson', endpoint: `${MARTIN}/v_web_bases_ideales` },
} as const satisfies Record<string, { nature: Nature; statique: string; endpoint: string }>;

export type JeuCarto = keyof typeof JEUX;

/** Chemin GeoJSON du jeu carto pour la source active. Pour un jeu `tuile`, préférer `martinTuiles`. */
export function cheminCarto(jeu: JeuCarto): string {
  return JEUX[jeu][SOURCE];
}

export function natureCarto(jeu: JeuCarto): Nature {
  return JEUX[jeu].nature;
}

/** Gabarit d'URL de tuiles Martin (MVT) pour une couche vectorielle (ex. sentiers). `null` en mode statique (repli GeoJSON). */
export function martinTuiles(jeu: JeuCarto): string | null {
  if (SOURCE !== 'endpoint' || JEUX[jeu].nature !== 'tuile') return null;
  return `${JEUX[jeu].endpoint}/{z}/{x}/{y}`;
}

/** Nom de la source-layer Martin (= nom de la vue) pour un jeu tuilé. */
export function martinSourceLayer(jeu: JeuCarto): string {
  // Le dernier segment de l'endpoint Martin = le nom de la vue/source-layer (ex. v_web_sentiers).
  const seg = JEUX[jeu].endpoint.split('/');
  return seg[seg.length - 1] ?? jeu;
}

/** Hook unique de lecture d'un jeu carto GeoJSON (static ou endpoint BFF, enveloppe dé-emballée par useGeojsonPublic). */
export function useCartoData(jeu: JeuCarto, actif = true) {
  return useGeojsonPublic(cheminCarto(jeu), actif);
}

// SOURCE UNIQUE des catégories de POI (étape 3, exigence de cohérence M224/M259). Une catégorie porte la MÊME
// couleur, le MÊME mot et la MÊME icône PARTOUT : carte, fiche, légende, filtre de l'Explorer. Ce fichier est ce
// contrat unique — carte/fiche/légende/filtre l'importent, aucun n'invente sa propre correspondance.
//
// Décision de conception (à cribler sur pixels) : 18 catégories réelles (`categorie_calque` de poi.geojson) ne
// tiennent pas en 18 couleurs lisibles. On regroupe en 6 FAMILLES (une couleur de charte chacune, on mène par le
// frais) ; à l'intérieur d'une famille, c'est l'ICÔNE qui distingue la catégorie. Couleur = thème, icône = type.
// Zéro hex : les couleurs sont des jetons résolus par `charte()` à l'usage.

export type CleFamille = 'eau' | 'nature' | 'marche' | 'ville' | 'etape' | 'reperes' | 'services';

export interface Famille {
  cle: CleFamille;
  libelle: string;
  token: string; // jeton de charte (résolu par charte())
  /** Famille RÉSERVÉE (place tenue, données pas encore là) — non câblée, pas de bucket. */
  reservee?: boolean;
}

// 6 familles actives + 1 RÉSERVÉE (M262 : conçu extensible pour 7). Séparation des 3 anciennes chaudes (M262) :
// « Étape & table » utilitaire → ardoise (neutre FROID, plus sombre que granite), distincte de « À faire & repères »
// (granite). Restent 2 chauds nets (Marche ocre / Ville terracotta) + 2 neutres séparés en valeur+température.
export const FAMILLES: Record<CleFamille, Famille> = {
  eau: { cle: 'eau', libelle: 'Eau & côte', token: '--glacier' },
  nature: { cle: 'nature', libelle: 'Nature & panorama', token: '--vert' },
  marche: { cle: 'marche', libelle: 'Marche & routes', token: '--ocre' },
  ville: { cle: 'ville', libelle: 'Ville & culture', token: '--espace-mes-envies' },
  etape: { cle: 'etape', libelle: 'Étape & table', token: '--ardoise' },
  reperes: { cle: 'reperes', libelle: 'À faire & repères', token: '--granite' },
  // RÉSERVÉE (M262) : aménités van (bobilplass, carburant, ravitaillement, parkings) — A wire les données, on garde
  // la place + une teinte distincte pour ne pas refondre. Non câblée tant que la donnée n'est pas là.
  services: { cle: 'services', libelle: 'Services & van', token: '--espace-preparatifs', reservee: true },
};

/** Clé d'icône (cf IconeCategorie). Une par catégorie, rondes, un seul style. */
export type CleIcone =
  | 'vue' | 'cascade' | 'glacier' | 'fjord' | 'nature' | 'parc' | 'plage' | 'ile'
  | 'rando' | 'route' | 'ville' | 'culture' | 'table' | 'lit' | 'activite' | 'van' | 'phare' | 'autre';

export interface CategoriePoi {
  /** Valeur exacte de `categorie_calque` dans la donnée (clé de jointure, ne pas traduire). */
  cle: string;
  /** Libellé FR affiché (légende, filtre, fiche) — le MÊME mot partout. */
  libelle: string;
  famille: CleFamille;
  icone: CleIcone;
}

// Les 18 buckets réels (dérivés de la base, R1), rangés par famille. Ordre = ordre de légende/filtre.
export const CATEGORIES: CategoriePoi[] = [
  // Eau & côte (glacier)
  { cle: 'fjord', libelle: 'Fjords', famille: 'eau', icone: 'fjord' },
  { cle: 'cascade', libelle: 'Cascades', famille: 'eau', icone: 'cascade' },
  { cle: 'glacier', libelle: 'Glaciers', famille: 'eau', icone: 'glacier' },
  { cle: 'plage', libelle: 'Plages', famille: 'eau', icone: 'plage' },
  { cle: 'ile', libelle: 'Îles', famille: 'eau', icone: 'ile' },
  { cle: 'phare', libelle: 'Phares', famille: 'eau', icone: 'phare' },
  // Nature & panorama (vert)
  { cle: 'point_de_vue', libelle: 'Points de vue', famille: 'nature', icone: 'vue' },
  { cle: 'parc_national', libelle: 'Parcs nationaux', famille: 'nature', icone: 'parc' },
  { cle: 'nature', libelle: 'Nature', famille: 'nature', icone: 'nature' },
  // Marche & routes (ocre)
  { cle: 'rando', libelle: 'Randonnées', famille: 'marche', icone: 'rando' },
  { cle: 'route', libelle: 'Routes panoramiques', famille: 'marche', icone: 'route' },
  // Ville & culture (terracotta)
  { cle: 'ville', libelle: 'Villes', famille: 'ville', icone: 'ville' },
  { cle: 'culture', libelle: 'Culture', famille: 'ville', icone: 'culture' },
  // Étape & table (sable)
  { cle: 'restauration', libelle: 'Tables', famille: 'etape', icone: 'table' },
  { cle: 'hebergement', libelle: 'Hébergements', famille: 'etape', icone: 'lit' },
  { cle: 'aire', libelle: 'Aires', famille: 'etape', icone: 'van' },
  // À faire & repères (granite)
  { cle: 'activite', libelle: 'Activités', famille: 'reperes', icone: 'activite' },
  { cle: 'autre', libelle: 'Autres', famille: 'reperes', icone: 'autre' },
];

const PAR_CLE: Record<string, CategoriePoi> = Object.fromEntries(CATEGORIES.map((c) => [c.cle, c]));
const AUTRE = PAR_CLE['autre']!;

/** Catégorie d'une valeur `categorie_calque` (repli « Autres » si inconnue, jamais d'erreur). */
export function categorieDe(cle: string | null | undefined): CategoriePoi {
  return (cle && PAR_CLE[cle]) || AUTRE;
}

// Correspondance catégorie SOURCE (41 valeurs de `categorie_source`) → bucket (18), DÉRIVÉE de la base (R1, 1:1),
// pour que la LISTE de l'Explorer (catalogue, champ `categorie` = source) partage le même bucket que la carte.
// Au flip, `v_web_poi` portera `categorie_calque` directement et ceci devient inutile.
export const SOURCE_VERS_BUCKET: Record<string, string> = {
  activite: 'activite',
  aire_design: 'aire',
  autre: 'autre',
  belvedere: 'point_de_vue',
  brasserie: 'restauration',
  cafe: 'restauration',
  cascade: 'cascade',
  circuit_ville: 'route',
  'conseil-acces': 'autre',
  dormir: 'hebergement',
  eglise: 'culture',
  festival: 'activite',
  fjord: 'fjord',
  glacier: 'glacier',
  ile: 'ile',
  'itineraire-velo': 'route',
  lac: 'nature',
  manger: 'restauration',
  monument: 'culture',
  musee: 'culture',
  nature: 'nature',
  'parc national': 'parc_national',
  paroi: 'point_de_vue',
  patrimoine: 'culture',
  phare: 'phare',
  plage: 'plage',
  'point de vue': 'point_de_vue',
  'point-interet': 'point_de_vue',
  quartier: 'ville',
  rando: 'rando',
  repere: 'point_de_vue',
  route: 'route',
  'route panoramique': 'route',
  route_touristique: 'route',
  sauna: 'activite',
  shopping: 'activite',
  sortir: 'restauration',
  'train-panoramique': 'route',
  vallee: 'nature',
  village: 'ville',
  ville: 'ville',
};

/** Bucket d'une catégorie SOURCE (repli « Autres »). Le pont liste↔carte tant que le catalogue n'a pas `categorie_calque`. */
export function bucketDepuisSource(source: string | null | undefined): CategoriePoi {
  return categorieDe(source ? SOURCE_VERS_BUCKET[source] : undefined);
}

/** Jeton de couleur d'une catégorie (via sa famille). À résoudre avec charte(). */
export function tokenCategorie(cle: string | null | undefined): string {
  return FAMILLES[categorieDe(cle).famille].token;
}

/**
 * Paires plates pour une expression MapLibre `['match', ['get','categorie_calque'], ...paires, defaut]` :
 * chaque bucket → sa couleur de famille RÉSOLUE (via `resoudre`, typiquement `charte`). Source unique de la couleur
 * carto ; la fiche/légende/filtre lisent la même chose via `tokenCategorie`.
 */
export function pairesCouleurCategorie(resoudre: (token: string) => string): string[] {
  return CATEGORIES.flatMap((c) => [c.cle, resoudre(FAMILLES[c.famille].token)]);
}

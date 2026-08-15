// Contrat carto pour le flip (B088 → M263) : métadonnées JSON que C lit PAR-DESSUS les tuiles MVT de Martin (qui, lui,
// sert la géométrie en lisant les vues diffusion en direct). Le BFF n'expose ici que du léger : la légende des calques
// (filtre par catégorie) et la hiérarchie de découpage. Les colonnes suivent le contrat des vues de diffusion v3 qu'A
// crée en Passe 2 (v_web_poi.categorie_calque, v_web_decoupage).

/** Un bucket de calque carto : la catégorie d'affichage (categorie_calque, ~17-18 buckets A079 + « services_van ») et
 *  son effectif. Sert la légende et le filtre « afficher/masquer par catégorie » de C. */
export interface CalqueBucket {
  categorie_calque: string;
  n: number;
}

/** Niveaux de la hiérarchie de découpage (emboîtement réel). */
export type NiveauDecoupage = 'region' | 'zone' | 'sous_zone';

/** Une entrée de la hiérarchie de découpage (v_web_decoupage) : niveau, identifiant, parent (null au sommet), nombre
 *  de POI rattachés. Géométrie servie par Martin, pas ici. */
export interface EntreeDecoupage {
  niveau: NiveauDecoupage;
  id: number;
  parent_id: number | null;
  n_poi: number;
}

/** Bucket de la légende sentiers : une difficulté (facile|moyen|difficile|expert|non_grade) et son effectif. */
export interface DifficulteSentier {
  difficulte: string;
  n: number;
}

/** Un circuit carto (v_web_circuits) : métadonnées ; géométrie (points) servie par Martin. */
export interface CircuitWeb {
  circuit_id: number;
  nom: string;
  distance_km: number | null;
  denivele_pos: number | null;
  tier_defaut: string | null;
  votable: boolean;
}

/** Une base carto (v_web_bases) : point de nuit ; métadonnées, géométrie servie par Martin. */
export interface BaseWeb {
  base_id: number;
  nom: string;
  tier_moyen: string | null;
  nuits_max_faisable: number | null;
}

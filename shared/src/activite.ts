// Budget-temps d'une activité ou d'une visite (A21). Le composeur ne compte plus seulement le TRAJET entre
// points, mais aussi le TEMPS PASSÉ SUR PLACE : la durée qu'on consacre à une baignade, un kayak, un point de
// vue. Cette durée a un plancher, un défaut, des paliers, un pas d'arrondi, et peut se déduire des préférences
// des voyageurs. Décisions Guillaume (14/08) : défaut par TYPE affinable par lieu et ajustable ; flânerie
// ajustable en plus, sans redondance avec la durée d'activité ; préférences = avis agrégés ET appétits
// thématiques par voyageur ; paliers libre / demi-journée / journée ; pas d'arrondi de 15 min (jamais 30).

/** Pas d'arrondi des durées : 15 minutes (Guillaume : jamais de pas de 30). */
export const PAS_MIN = 15;
/** Repères de palier, réglables côté calcul (routing_params). Une demi-journée ~4 h, une journée ~8 h. */
export const DEMI_JOURNEE_MIN = 240;
export const JOURNEE_MIN = 480;

/**
 * Granularité d'une activité :
 * - `libre` : se prend dès son plancher, par pas de 15 min (baignade ≥ 1 h, point de vue ≥ 15 min).
 * - `demi_journee` / `journee` : activité « en bloc » (kayak) qui ne se prend pas en dessous du palier
 *   (« en dessous compliqué pour elle »). Le budget se choisit parmi les paliers offerts.
 */
export type Granularite = 'libre' | 'demi_journee' | 'journee';

/**
 * Thème d'une activité, support des appétits thématiques (nautique, faune, patrimoine, rando, baignade,
 * panorama…). Chaîne ouverte : la typologie vit côté calcul (A), le contrat ne la fige pas.
 */
export type Theme = string;

/**
 * Typologie : le TYPE d'activité porte les défauts de durée. Source unique côté calcul (A), affinable par lieu.
 * `granularites` liste les paliers offerts quand la granularité n'est pas libre (ex. kayak : demi-journée + journée).
 */
export interface TypeActivite {
  code: string;
  libelle: string;
  min_min: number;
  defaut_min: number;
  max_min?: number;
  granularite: Granularite;
  /** Paliers proposés si `granularite` ≠ libre (en minutes) ; ignoré si libre. */
  granularites?: number[];
  themes: Theme[];
}

/** D'où vient la durée retenue d'une visite (traçabilité, R1 : ne pas confondre défaut et choix). */
export type SourceDuree = 'type' | 'lieu' | 'preference' | 'manuel';

/**
 * Budget-temps résolu pour UNE visite dans une composition. Le composeur (B) le consomme pour remplir un jour ;
 * l'écran (C) l'affiche et le laisse ajuster (curseur + saisie liée). `duree_retenue_min` est toujours
 * réajustable à la main (source `manuel`), bornée [min, max] et arrondie à `pas_min`.
 */
export interface BudgetTempsVisite {
  min_min: number;
  defaut_min: number;
  max_min?: number;
  pas_min: number;
  granularite: Granularite;
  granularites?: number[];
  /** Durée effectivement allouée à cette visite dans le jour. */
  duree_retenue_min: number;
  source: SourceDuree;
}

/**
 * Appétit thématique d'un voyageur : « je veux faire plein de nautique / de safari photo faune ». Fait monter
 * la durée ALLOUÉE (et le poids de sélection) des activités de ces thèmes. Agrégé sur le groupe en consensus
 * égalitariste, comme les avis. `appetit` normalisé [0..1] (0 = neutre, 1 = fort).
 */
export interface AppetitThematique {
  theme: Theme;
  appetit: number;
}

/**
 * Facteurs qui modulent la durée proposée d'une activité, tous bornés et cumulables, résultat toujours
 * reclampé [min, max] puis arrondi. Le calcul vit chez A ; ce type dit seulement ce qui entre en jeu.
 * - `facteur_avis` : dérivé de l'avis agrégé (Coup de cœur > Vraiment envie > Bien > Pourquoi pas).
 * - `facteur_appetit` : dérivé des appétits thématiques du groupe pour les thèmes de l'activité.
 */
export interface ModulationDuree {
  facteur_avis: number;
  facteur_appetit: number;
}

/**
 * Temps de flânerie d'un jour (ou d'une escale) : balade non programmée, pauses, marché, port. DISTINCT des
 * durées d'activité pour NE PAS créer de redondance (Guillaume : « pas de redondances, pas simple à doser »).
 * Le composeur l'ajoute au budget-jour à côté des trajets et des visites, il ne le dilue pas dans les durées.
 * Réglable ; défaut modeste côté calcul.
 */
export interface Flanerie {
  flanerie_min: number;
}

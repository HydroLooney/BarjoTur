// Couche db : appel générique des fonctions RPC `api.*` de DB2. C'est le point unique qui fronte
// la surface PostgREST héritée pendant la bascule (retrait PostgREST en 3 crans, cf B001).
// Le nom de fonction est validé contre une liste blanche : jamais d'identifiant construit depuis l'entrée.
// Les fonctions api.* renvoient du jsonb ; `pg` le désérialise déjà en objet JS.

import { query } from './query.js';

/**
 * Liste blanche des fonctions RPC frontées. On l'étend au fil des chantiers, uniquement quand un service les câble.
 *
 * - whoami, mes_votes, set_votes, set_vote, fige_lire, scenario_defaut : contrats initiaux (T009/T010/M011).
 * - fige_enregistrer_systeme : écriture du composeur (C06). Le BFF peut déclencher la persistance
 *   via POST /api/composer (persister:true), en complément du sidecar qui persiste directement.
 * - catalogue, poi_in_bbox : lecture POI (phase ultérieure).
 * - voyageur_* (M012) : exposer le vocabulaire sans rename physique — si l'API DB2 expose des fonctions
 *   voyageur_*, les ajouter ici au fil de leur déploiement. Aucun rename des tables physiques (B006).
 */
export const RPC_AUTORISEES = [
  'mes_votes',
  'set_votes',
  'set_vote',
  'fige_lire',
  'fige_enregistrer_systeme',
  'whoami',
  'scenario_defaut',
  'catalogue',
  'poi_in_bbox',
  'ajouter_poi',
  'poi_propositions',
  'signaler',
  'signalements_ouverts',
  'mes_lieux_par_tier',
  'budget_comparatif',
  'budget_variante',
  'mon_esprit',
  'set_esprit',
  'esprit_famille',
  'esprit_aggregate',
  'archetypes',
  'exploration_lire',
  'exploration_marquer',
  'collection_lire',
  'collection_ecrire',
  'parcours_lire',
  'parcours_enregistrer',
  'voyage_lire',
  'voyageurs_lire',
  'voyageur_role_changer',
  'voyageur_lien_regenerer',
  'budget_temps_poi',
  'appetit_lire',
  'appetit_ecrire',
  'circuits_lire',
  'circuit_lire',
  'zones_activites_lire',
  'variante_liaison',
  'voyageur_lien_generer',
  'voyageur_lien_revoquer',
  // Carto (M272 §3, B088) : wrappers des vues de diffusion v3 (livrées par A en Passe 2). Absentes d'ici là → 42883.
  'carto_calques',
  'carto_decoupage',
  'carto_sentiers_difficultes',
  'carto_circuits',
  'carto_bases',
  // Réglages (M361/M363) : lecture/écriture des params budget.parametre par famille (écriture gatée go bascule, 014).
  'reglages_lire',
  'reglage_ecrire',
  // Carto GeoJSON (M367) : couches servies depuis les vues diffusion (plus de statique). Absentes en dev → FC vide.
  'carto_poi_geojson',
  'carto_decoupage_geojson',
  'carto_services_van_geojson',
  'carto_routes_sceniques_geojson',
  'carto_sentiers_geojson',
  // Circuits + bases idéales en GeoJSON (M410/C139) : derniers statiques retirés. Vues au dump final → 42883/FC vide d'ici là.
  'carto_circuits_geojson',
  'carto_bases_geojson',
  // Recos personnalisées par voyageur (M380) : top-N POI par sa valeur/appétit.
  'recos_voyageur',
  // Fiche POI (M405/A140) : détail (poi.poi) + photos (v_web_poi_photos au dump final). poi_photos absente d'ici là → 42883/manifeste.
  'poi_detail',
  'poi_photos',
  // Échange atomique de vote (M392) : retire + pose au même tier en une transaction.
  'echanger_vote',
  // Paniers hors-budget & cascade (M393/M396) : lecture des paniers, pose du surplus hors-budget (voie b),
  // cascade de déclassement (voie a). Atomiques, posées au flip → 42883 avant, dégradation propre (surplus non compté).
  'paniers_lire',
  'poser_hors_budget',
  'cascade_declassement',
] as const;

export type RpcAutorisee = (typeof RPC_AUTORISEES)[number];

/** Un argument lié, avec un cast Postgres optionnel (ex. un objet passé en jsonb). */
export interface ArgRpc {
  valeur: unknown;
  cast?: 'text' | 'text[]' | 'jsonb' | 'bigint' | 'integer' | 'numeric' | 'double precision';
}

/** Argument texte simple. */
export function argTexte(valeur: string | null): ArgRpc {
  return { valeur, cast: 'text' };
}

/** Argument jsonb : l'objet est sérialisé puis casté ::jsonb côté SQL. */
export function argJsonb(valeur: unknown): ArgRpc {
  return { valeur: JSON.stringify(valeur), cast: 'jsonb' };
}

/** Argument tableau de texte (text[]), pour les RPC à param `text[]` (ex. espaces visibles d'un lien). `null` → NULL. */
export function argTexteArray(valeur: readonly string[] | null): ArgRpc {
  return { valeur: valeur === null ? null : [...valeur], cast: 'text[]' };
}

/** Argument entier long (bigint). On passe la valeur en chaîne pour éviter toute perte de précision. */
export function argBigint(valeur: number): ArgRpc {
  return { valeur: String(valeur), cast: 'bigint' };
}

/** Argument `numeric` (pour les RPC dont la signature est numeric, ex. appetit ∈ [0,1]). Passé en chaîne (précision),
 *  casté ::numeric : `double precision` ne résout PAS un paramètre numeric (pas de cast implicite). */
export function argNumerique(valeur: number): ArgRpc {
  return { valeur: String(valeur), cast: 'numeric' };
}

/** Argument entier (integer), pour les RPC dont la signature est `int` (ex. poi_id). Résolution de fonction exacte. */
export function argEntier(valeur: number): ArgRpc {
  return { valeur, cast: 'integer' };
}

/** Argument flottant (double precision), pour les coordonnées et autres réels. */
export function argFloat(valeur: number): ArgRpc {
  return { valeur, cast: 'double precision' };
}

/** Dégradation propre (M147/M173) : tant qu'A n'a pas posé une RPC (tables pas livrées), Postgres lève
 *  `undefined_function` (SQLSTATE 42883). On rend alors `defaut` (→ 200 vide) au lieu d'un 500. TOUTE autre erreur
 *  remonte (un vrai problème doit rester visible). Se retire de lui-même à la livraison d'A. */
export async function siRpcAbsente<T>(promesse: Promise<T>, defaut: T): Promise<T> {
  try {
    return await promesse;
  } catch (e) {
    if ((e as { code?: string })?.code === '42883') return defaut;
    throw e;
  }
}

/**
 * Appelle `select api.<fn>($1, $2, ...)` et rend la valeur jsonb renvoyée, typée par l'appelant.
 * Le typage T est une promesse de forme : la vérité reste le contrat api.* de DB2.
 */
export async function appelerRpc<T>(fn: RpcAutorisee, args: readonly ArgRpc[] = []): Promise<T> {
  if (!RPC_AUTORISEES.includes(fn)) {
    // Garde-fou défensif : ne devrait jamais arriver, le type l'interdit déjà.
    throw new Error(`Fonction RPC non autorisée : ${fn}`);
  }
  const placeholders = args
    .map((a, i) => `$${i + 1}${a.cast ? `::${a.cast}` : ''}`)
    .join(', ');
  const texte = `select api.${fn}(${placeholders}) as resultat`;
  const valeurs = args.map((a) => a.valeur);
  const lignes = await query<{ resultat: T }>(texte, valeurs);
  return lignes[0]!.resultat;
}

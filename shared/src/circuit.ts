// Circuits tout-faits des guides + activité idéale par zone (A23). Deux enrichissements sourcés des guides papier
// (haute vérité) qui se posent sur le modèle existant : le CIRCUIT est le niveau lieu→circuit→zone→région déjà bâti,
// l'ACTIVITÉ IDÉALE PAR ZONE réutilise la typologie `Theme` des activités. Décisions Guillaume (14/08) : les deux
// (bibliothèque adoptable + signal pour la base) ; un circuit du guide est un CANEVAS SOUPLE, modifiable de A à Z,
// re-routé en van/rando quel que soit le mode d'origine (train, vélo… restent utiles par leur sélection et leur ordre).

import type { Theme } from './activite.js';

/** Mode d'origine d'un circuit dans le guide (on garde l'info ; l'adoption re-route en van/rando). */
export type ModeCircuit = 'pied' | 'velo' | 'voiture' | 'van' | 'train' | 'bateau' | 'mixte';

/** Grain de durée d'un circuit proposé par le guide. */
export type DureeCircuit = 'demi_journee' | '24h' | 'journee' | 'jours';

/** Provenance sourcée (R1, A22) : quel guide, quelle page imprimée. */
export interface SourceGuide {
  guide: string;
  page?: string;
}

/** Une étape ordonnée d'un circuit. `poi_id` est rempli à la réconciliation avec la base (sinon lieu non encore apparié). */
export interface EtapeCircuit {
  ordre: number;
  nom: string;
  poi_id?: number;
  /** Ce que le guide dit de l'étape. */
  note?: string;
  /** Temps sur place suggéré. */
  duree_min?: number;
  /** Horaire indicatif pour un circuit type « 24h » (ex. « 8h30 »). */
  horaire?: string;
}

/**
 * Circuit tout-fait d'un guide, adoptable comme CANEVAS de départ (Guillaume : souple, modifiable de A à Z). Sert
 * aussi de signal pour la base : groupement lieu→circuit, agrégation des votes par circuit, endossement des lieux
 * qu'il enchaîne (le guide a jugé cet enchaînement digne d'un parcours).
 */
export interface Circuit {
  id?: number;
  nom: string;
  source: SourceGuide;
  mode_origine: ModeCircuit;
  duree: DureeCircuit;
  /** Nombre de jours si `duree = 'jours'`. */
  jours?: number;
  etapes: EtapeCircuit[];
  conseils?: string[];
  /** Zone ou région où se déroule le circuit. */
  zone?: string;
}

/**
 * Activité idéale d'une zone selon le guide (« ici, c'est le kayak ; là, le rafting »). Association zone × thème
 * d'activité, sourcée. Boost les lieux de ce thème dans cette zone et alimente les recommandations de zone
 * (et le rapprochement avec les envies par thème d'un voyageur). `theme` réutilise la typologie des activités.
 */
export interface ZoneActiviteIdeale {
  zone: string;
  theme: Theme;
  source: SourceGuide;
  note?: string;
  /** Nombre de lieux de ce thème rattachés à la zone (fourni par A). 0 → « aucun lieu encore rattaché », pas de lien mort. */
  nb_lieux_rattaches?: number;
}

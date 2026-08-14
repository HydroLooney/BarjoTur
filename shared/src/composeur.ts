import type { LineStringGeom, MultiLineStringGeom } from './geo.js';
import type { NatureEtape } from './voyage.js';

// Contrats du composeur (C06). Le BFF est un passe-plat du sidecar Python (OR-Tools) : il ne retraite pas
// la sémantique. Formes relevées par B (B010). `fige`/`etapes` restent `unknown` tant que le détail n'est pas figé ;
// `geom` est fixé (LineString ou MultiLineString) pour permettre l'animation côté front (C, C-11).

/** Un archétype de voyage (une ambiance), proposé au vote et à la composition. Détail enrichi au fil de T013. */
export interface Archetype {
  key: string;
  label: string;
  description?: string;
}

/** Corps de POST /api/composer (validation BFF). */
export interface ComposeInput {
  /** base_id des bases candidates. Non vide. */
  bases: number[];
  /** Archétype ; absent = signature neutre équilibrée. */
  archetype_key?: string | null;
  /** Calculer l'agenda journée (micro-OP jour). Défaut true. */
  avec_agenda?: boolean;
  /** Persister le résultat dans fige. Défaut false. */
  persister?: boolean;
  /** Arrêts imposés du faisceau (épinglés ou réservés, A19) : contrainte dure poussée au calcul. Additif. */
  arretsImposes?: ArretImpose[];
}

/** Un arrêt imposé passé au composeur (épinglé par l'utilisateur ou réservé), contrainte dure du faisceau (A19). */
export interface ArretImpose {
  base_id?: number | null;
  lat: number;
  lon: number;
}

/**
 * Une étape routée de l'itinéraire mixte : sa nature (expérience ou transit), son ordre, sa géométrie et ses
 * métriques. Sortie de l'orchestration (B) et rendue par le front, animée selon son mode.
 */
export interface EtapeRoutee {
  nature: NatureEtape;
  ordre: number;
  geom?: LineStringGeom | MultiLineStringGeom | null;
  meta?: ComposeMeta;
  /** Étape de transit non encore routée (corridor absent) : en attente. */
  statut?: 'route' | 'en_attente_corridor';
}

/** Métriques renvoyées par le sidecar. */
export interface ComposeMeta {
  n_bases: number;
  nuits: number;
  value: number;
  drive_h: number;
  leg_max_h?: number;
}

/** Réponse du sidecar (passe-plat). `fige` renvoyé si persister=true. */
export interface ComposeReponse {
  ok: boolean;
  error?: string;
  compose?: ComposeMeta;
  n_etapes?: number;
  fige?: unknown;
  route?: number[];
  nights_par_base?: Record<string, number>;
  nuits_deficit?: number;
  geom_sequence?: number[];
  /** Géométrie continue du résultat, pour l'animation (C-11). null tant que non calculée. */
  geom?: LineStringGeom | MultiLineStringGeom | null;
  /** Suite mixte typée expérience/transit, pour rendre et animer chaque étape par son mode (C027). */
  etapes?: EtapeRoutee[];
  agenda_error?: string;
}

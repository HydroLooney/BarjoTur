// Service itinéraire MIXTE (composeur transit-aware, M059) : orchestre une suite d'étapes typées expérience/transit.
// Non-routable : l'expérience passe par le composeur (orienteering, déjà là), le transit est PRÉPARÉ (arrêts imposés)
// et marqué en attente du corridor d'A (l'optim transit s'y câble). Le routeur d'expérience est INJECTÉ (testable).

import { Erreurs } from '../http/erreurs.js';
import { validerComposeInput, composer } from './composeur.js';
import { arretsImposes } from './transit.js';
import type { ArretImpose, ComposeInput, ComposeReponse, EtapeRoutee } from '../domain/composeur.js';
import type { ArretTransit, EtapeTransit, PointVoyage } from '../domain/voyage.js';
import type { EtapeItineraire, ItineraireOrchestre } from '../domain/itineraire.js';

function estPoint(v: unknown): v is PointVoyage {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.label === 'string' && typeof p.lat === 'number' && typeof p.lon === 'number';
}

/** Valide une étape de transit (structure : depuis/vers points, faisceau tableau, jalon_date texte|null). Pure. */
export function validerEtapeTransit(brut: unknown): EtapeTransit {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    throw Erreurs.requeteInvalide('Une étape de transit doit être un objet JSON.');
  }
  const t = brut as Record<string, unknown>;
  if (!estPoint(t.depuis) || !estPoint(t.vers)) {
    throw Erreurs.requeteInvalide('Étape transit : depuis/vers doivent être des points {label,lat,lon}.');
  }
  if (!Array.isArray(t.faisceau)) {
    throw Erreurs.requeteInvalide('Étape transit : le faisceau doit être un tableau (éventuellement vide).');
  }
  const jalon = t.jalon_date === undefined || t.jalon_date === null ? null : t.jalon_date;
  if (jalon !== null && typeof jalon !== 'string') {
    throw Erreurs.requeteInvalide('Étape transit : jalon_date doit être une chaîne ISO ou null.');
  }
  // budget_min (M305) : budget de route en minutes de l'étape obligatoire ; null/absent = libre. Entier ≥ 0.
  const budget = t.budget_min === undefined || t.budget_min === null ? null : t.budget_min;
  if (budget !== null && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0)) {
    throw Erreurs.requeteInvalide('Étape transit : budget_min doit être un nombre de minutes ≥ 0 ou null.');
  }
  return {
    id: typeof t.id === 'string' ? t.id : '',
    ordre: typeof t.ordre === 'number' ? t.ordre : 0,
    depuis: t.depuis as PointVoyage,
    vers: t.vers as PointVoyage,
    jalon_date: jalon,
    faisceau: t.faisceau as EtapeTransit['faisceau'],
    budget_min: budget,
  };
}

/** Valide la séquence d'étapes typées (non vide ; chaque étape = experience|transit valide). Pure. */
export function validerEtapesItineraire(corps: unknown): EtapeItineraire[] {
  if (typeof corps !== 'object' || corps === null) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet { etapes: [...] }.');
  }
  const etapesBrutes = (corps as Record<string, unknown>).etapes;
  if (!Array.isArray(etapesBrutes) || etapesBrutes.length === 0) {
    throw Erreurs.requeteInvalide('Le champ "etapes" doit être un tableau non vide.');
  }
  return etapesBrutes.map((e, i) => {
    if (typeof e !== 'object' || e === null) {
      throw Erreurs.requeteInvalide(`Étape ${i} : objet attendu.`);
    }
    const nature = (e as Record<string, unknown>).nature;
    if (nature === 'experience') {
      return { nature: 'experience', experience: validerComposeInput((e as Record<string, unknown>).experience) };
    }
    if (nature === 'transit') {
      return { nature: 'transit', transit: validerEtapeTransit((e as Record<string, unknown>).transit) };
    }
    throw Erreurs.requeteInvalide(`Étape ${i} : nature invalide (attendu 'experience' ou 'transit').`);
  });
}

/** Traduit les arrêts imposés du faisceau (réservés + épinglés) en contrainte dure `ArretImpose[]` pour le composeur
 *  (M062 : `ComposeInput.arretsImposes`). Sert au routage transit quand le corridor d'A arrive. Pure. */
export function arretsImposesPourCompose(faisceau: ArretTransit[]): ArretImpose[] {
  return arretsImposes(faisceau).map((a) => ({ lat: a.lat, lon: a.lon }));
}

/** Séquence de bases à router par A* réservation (A33) + les imposés non routables (signalés, R1). */
export interface SequenceReservation {
  /** Séquence ORDONNÉE de `base_id` à passer à `api.geom_route_astar` : départ, jalons imposés, arrivée. */
  bases: number[];
  /** Imposés SANS `base_id` : non plaçables sur le graphe des bases, donc écartés du routage (honnêteté R1). */
  imposes_non_routables: ArretImpose[];
}

/**
 * A* réservation (A33) : une réservation confirmée est un JALON IMPOSÉ (A18/A19 §8.1, cf `epinglerReserves`) que le
 * routage A* base-à-base DOIT traverser. On assemble la séquence ordonnée de `base_id` — départ, imposés routables (dans
 * l'ordre reçu), arrivée — à passer à `api.geom_route_astar(int[])` (graphe `ways_*`, lecture seule DB2). Les imposés
 * sans `base_id` ne sont pas plaçables sur le graphe des bases : on les ÉCARTE et on les SIGNALE (R1), on n'invente pas
 * de tracé. Les doublons consécutifs (un imposé confondu avec le départ, l'arrivée ou le précédent) sont fusionnés pour
 * ne pas router un tronçon nul. Pure.
 */
export function sequenceReservationBases(
  depart: number,
  arrivee: number,
  imposes: readonly ArretImpose[],
): SequenceReservation {
  const routables = imposes.filter((a): a is ArretImpose & { base_id: number } => a.base_id != null);
  const imposes_non_routables = imposes.filter((a) => a.base_id == null);
  const brute = [depart, ...routables.map((a) => a.base_id), arrivee];
  const bases = brute.filter((b, i) => i === 0 || b !== brute[i - 1]);
  return { bases, imposes_non_routables };
}

/**
 * Orchestre l'itinéraire mixte : route chaque étape avec SON mode et rend une suite `EtapeRoutee[]` (forme partagée
 * M062, identique à `ComposeReponse.etapes`). Expérience → composeur (orienteering), geom+meta, statut `route`.
 * Transit → étape non encore routée (statut `en_attente_corridor`) ; ses arrêts imposés (contrainte dure) sont
 * calculés pour le sidecar au corridor. Le routeur d'expérience est injecté (défaut `composer`) pour le rendre testable.
 * L'ordre est préservé ; `transit_en_attente` compte les transits en attente du corridor.
 */
export async function orchestrerItineraire(
  etapes: EtapeItineraire[],
  routeurExperience: (input: ComposeInput) => Promise<ComposeReponse> = composer,
): Promise<ItineraireOrchestre> {
  const routees: EtapeRoutee[] = [];
  let enAttente = 0;
  for (let ordre = 0; ordre < etapes.length; ordre++) {
    const e = etapes[ordre]!;
    if (e.nature === 'experience') {
      const r = await routeurExperience(e.experience);
      routees.push({ nature: 'experience', ordre, geom: r.geom ?? null, meta: r.compose, statut: 'route' });
    } else {
      enAttente++;
      routees.push({ nature: 'transit', ordre, statut: 'en_attente_corridor' });
    }
  }
  return { ok: true, etapes: routees, transit_en_attente: enAttente };
}

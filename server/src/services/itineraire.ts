// Service itinéraire MIXTE (composeur transit-aware, M059) : orchestre une suite d'étapes typées expérience/transit.
// Non-routable : l'expérience passe par le composeur (orienteering, déjà là), le transit est PRÉPARÉ (arrêts imposés)
// et marqué en attente du corridor d'A (l'optim transit s'y câble). Le routeur d'expérience est INJECTÉ (testable).

import { Erreurs } from '../http/erreurs.js';
import { validerComposeInput, composer } from './composeur.js';
import { arretsImposes } from './transit.js';
import type { ComposeInput, ComposeReponse } from '../domain/composeur.js';
import type { EtapeTransit, PointVoyage } from '../domain/voyage.js';
import type { EtapeItineraire, EtapeRoutee, ItineraireOrchestre } from '../domain/itineraire.js';

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
  return {
    id: typeof t.id === 'string' ? t.id : '',
    ordre: typeof t.ordre === 'number' ? t.ordre : 0,
    depuis: t.depuis as PointVoyage,
    vers: t.vers as PointVoyage,
    jalon_date: jalon,
    faisceau: t.faisceau as EtapeTransit['faisceau'],
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

/** Prépare une étape de transit : fige les arrêts imposés (réservés + épinglés) comme contrainte dure, statut en
 *  attente du corridor (l'optim transit se câble à la livraison d'A). Pure. */
export function preparerTransit(etape: EtapeTransit): EtapeRoutee['transit'] {
  return { etape, arrets_imposes: arretsImposes(etape.faisceau), statut: 'en_attente_corridor' };
}

/**
 * Orchestre l'itinéraire mixte : route chaque étape avec SON mode. Expérience → composeur (orienteering). Transit →
 * préparé + en attente du corridor. Le routeur d'expérience est injecté (défaut = `composer`) pour le rendre testable.
 * L'ordre de la séquence est préservé ; `transit_en_attente` compte les transits non encore routés.
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
      routees.push({ ordre, nature: 'experience', experience: await routeurExperience(e.experience) });
    } else {
      enAttente++;
      routees.push({ ordre, nature: 'transit', transit: preparerTransit(e.transit) });
    }
  }
  return { ok: true, etapes: routees, transit_en_attente: enAttente };
}

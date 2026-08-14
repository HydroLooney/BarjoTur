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

/** Traduit les arrêts imposés du faisceau (réservés + épinglés) en contrainte dure `ArretImpose[]` pour le composeur
 *  (M062 : `ComposeInput.arretsImposes`). Sert au routage transit quand le corridor d'A arrive. Pure. */
export function arretsImposesPourCompose(faisceau: ArretTransit[]): ArretImpose[] {
  return arretsImposes(faisceau).map((a) => ({ lat: a.lat, lon: a.lon }));
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

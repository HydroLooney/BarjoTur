// Service esprit de voyage : lecture/écriture des curseurs du voyageur, esprit famille et agrégat collégial.
// Ne connaît pas Express. Identité = lien perso (code), non gaté PIN. Passe-plat des RPC api.esprit_*.

import { appelerRpc, argTexte, argJsonb } from '../db/rpc.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import type { CarteAxes, EspritInput } from '../domain/esprit.js';

function carteAxes(brut: unknown, nom: string): CarteAxes | null {
  if (brut === undefined || brut === null) return null;
  if (typeof brut !== 'object' || Array.isArray(brut)) {
    throw Erreurs.requeteInvalide(`La section ${nom} doit être un objet axe→nombre.`);
  }
  const out: CarteAxes = {};
  for (const [axe, val] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw Erreurs.requeteInvalide(`Valeur non numérique pour ${nom}.${axe}.`);
    }
    out[axe] = val;
  }
  return out;
}

/** Valide et normalise l'esprit reçu. Pure, testable sans DB. */
export function validerEsprit(corps: unknown): EspritInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  return {
    choix: carteAxes(c.choix, 'choix'),
    poids: carteAxes(c.poids, 'poids'),
    cibles: carteAxes(c.cibles, 'cibles'),
  };
}

/** Mon esprit (curseurs, poids, cibles). 404 si le lien est inconnu. */
export async function monEsprit(code: string): Promise<unknown> {
  const res = await appelerRpc<unknown>('mon_esprit', [argTexte(code)]);
  return exigerPresent(res, Erreurs.codeInconnu);
}

/** Enregistre mon esprit (la RPC n'écrase pas avec du vide). Passe-plat : ok:false = code inconnu. */
export async function enregistrerEsprit(code: string, e: EspritInput): Promise<unknown> {
  return appelerRpc<unknown>('set_esprit', [
    argTexte(code),
    argJsonb(e.choix ?? {}),
    argJsonb(e.poids ?? {}),
    argJsonb(e.cibles ?? {}),
  ]);
}

/** Esprit de la famille (nominatif, ouvert à tout lien valide). */
export async function espritFamille(code: string): Promise<unknown> {
  const res = await appelerRpc<unknown>('esprit_famille', [argTexte(code)]);
  return exigerPresent(res, Erreurs.codeInconnu);
}

/** Agrégat collégial de l'esprit (consensus des curseurs). */
export async function espritAggregate(code: string): Promise<unknown> {
  const res = await appelerRpc<unknown>('esprit_aggregate', [argTexte(code)]);
  return exigerPresent(res, Erreurs.codeInconnu);
}

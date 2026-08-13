// Service carnet perso : ajout de lieu voyageur, propositions, lieux par tier, signalements (Explorer, T015).
// Ne connaît pas Express. Identité = lien perso (code) ; l'ajout et le signalement portent en plus le PIN
// (la RPC vérifie le PIN côté serveur, autorité serveur). Passe-plat des RPC api.*.

import { appelerRpc, argTexte, argFloat } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { AjoutPoiInput, SignalInput } from '../domain/carnet.js';

function chaineNonVide(brut: unknown, nom: string): string {
  if (typeof brut !== 'string' || brut.trim() === '') {
    throw Erreurs.requeteInvalide(`Champ requis manquant ou vide : ${nom}.`);
  }
  return brut;
}

function chaineOptionnelle(brut: unknown, nom: string): string | null {
  if (brut === undefined || brut === null) return null;
  if (typeof brut !== 'string') {
    throw Erreurs.requeteInvalide(`Champ ${nom} doit être une chaîne.`);
  }
  return brut;
}

function coordonnee(brut: unknown, nom: string, min: number, max: number): number {
  if (typeof brut !== 'number' || !Number.isFinite(brut)) {
    throw Erreurs.requeteInvalide(`Coordonnée ${nom} absente ou non numérique.`);
  }
  if (brut < min || brut > max) {
    throw Erreurs.requeteInvalide(`Coordonnée ${nom} hors bornes [${min}, ${max}].`);
  }
  return brut;
}

/** Valide et normalise l'ajout d'un lieu voyageur. Pure, testable sans DB. */
export function validerAjoutPoi(corps: unknown): AjoutPoiInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  return {
    pin: chaineNonVide(c.pin, 'pin'),
    nom: chaineNonVide(c.nom, 'nom'),
    lon: coordonnee(c.lon, 'lon', -180, 180),
    lat: coordonnee(c.lat, 'lat', -90, 90),
    categorie: chaineOptionnelle(c.categorie, 'categorie'),
    sous_categorie: chaineOptionnelle(c.sous_categorie, 'sous_categorie'),
    presentation: chaineOptionnelle(c.presentation, 'presentation'),
  };
}

/** Valide et normalise un signalement de POI. Pure. */
export function validerSignal(corps: unknown): SignalInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  return {
    osm_id: chaineNonVide(c.osm_id, 'osm_id'),
    motif: chaineNonVide(c.motif, 'motif'),
    commentaire: chaineOptionnelle(c.commentaire, 'commentaire'),
  };
}

/** Ajoute un lieu au carnet du voyageur (gaté PIN côté RPC). Passe-plat : ok:false = état métier (pin, doublon...). */
export async function ajouterLieu(code: string, i: AjoutPoiInput): Promise<unknown> {
  return appelerRpc<unknown>('ajouter_poi', [
    argTexte(code),
    argTexte(i.pin),
    argTexte(i.nom),
    argFloat(i.lon),
    argFloat(i.lat),
    argTexte(i.categorie),
    argTexte(i.sous_categorie),
    argTexte(i.presentation),
  ]);
}

/** Mes propositions de lieux (voyageur). */
export async function lesPropositions(code: string): Promise<unknown> {
  return appelerRpc<unknown>('poi_propositions', [argTexte(code)]);
}

/** Mes lieux classés par tier. */
export async function mesLieuxParTier(code: string): Promise<unknown> {
  return appelerRpc<unknown>('mes_lieux_par_tier', [argTexte(code)]);
}

/** Signale un POI (gaté PIN côté RPC). */
export async function signalerPoi(code: string, s: SignalInput): Promise<unknown> {
  return appelerRpc<unknown>('signaler', [
    argTexte(code),
    argTexte(s.osm_id),
    argTexte(s.motif),
    argTexte(s.commentaire),
  ]);
}

/** Signalements ouverts (modération). */
export async function lesSignalements(code: string): Promise<unknown> {
  return appelerRpc<unknown>('signalements_ouverts', [argTexte(code)]);
}

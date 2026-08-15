// Service philosophie de voyage (M508, crible B159) : lire le catalogue + le profil d'un voyageur, l'écrire (versionné),
// et MAPPER le profil vers une signature d'objectif du composeur (le « sens », note 04). Ne connaît pas Express.
// Source unique DB2 (decision.philosophie_*, migration 020), liée au membre. Passe-plat des RPC api.philosophie_*.
// Écriture gatée capacité `voter` (autorité serveur, comme l'appétit) + idempotente. Contrat = shared 3c46a57.
//
// LIVE = 7 curseurs + 4 envies (th_*) + cap_nord. Nouveauté/Tempo sont STOCKÉS mais n'agissent pas encore sur la
// signature (actifLive=false, câblés v3.1). Le leximin famille (Notre voyage) = v3.1 (M496). La formule exacte
// (orness/THEME_W/renormalisation) = v3.1 : ici on mappe le SENS directionnel, validé pour le live (M508).

import { appelerRpc, argTexte, argJsonb } from '../db/rpc.js';
import { Erreurs, ErreurRequete } from '../http/erreurs.js';
import { lireWhoami } from './identite.js';
import { exigerCapacite } from './voyageurs.js';
import {
  CURSEUR_CLES,
  ENVIE_CLES,
  type PhilosophieProfil,
  type PhilosophieReponse,
  type PhilosophieMajInput,
  type SignatureComposeur,
} from '../domain/philosophie.js';

/** Borne un nombre dans [0,1] ; rejette ce qui n'est pas un nombre fini. */
function exigerUnitaire(v: unknown, quoi: string): number {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v) || v < 0 || v > 1) {
    throw Erreurs.requeteInvalide(`${quoi} doit être un nombre dans [0, 1].`);
  }
  return v;
}

/** Valide le corps de PUT : profil PARTIEL { curseurs?, envies?, cap_nord? }. Rejette toute clé hors contrat. Pure. */
export function validerMajProfil(corps: unknown): PhilosophieMajInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet { curseurs?, envies?, cap_nord? }.');
  }
  const c = corps as Record<string, unknown>;
  const maj: PhilosophieMajInput = {};

  if (c.curseurs !== undefined) {
    if (typeof c.curseurs !== 'object' || c.curseurs === null) throw Erreurs.requeteInvalide('"curseurs" doit être un objet.');
    const src = c.curseurs as Record<string, unknown>;
    const out: Partial<Record<(typeof CURSEUR_CLES)[number], number>> = {};
    for (const cle of Object.keys(src)) {
      if (!(CURSEUR_CLES as readonly string[]).includes(cle)) throw Erreurs.requeteInvalide(`Curseur inconnu : ${cle}.`);
      out[cle as (typeof CURSEUR_CLES)[number]] = exigerUnitaire(src[cle], `curseurs.${cle}`);
    }
    maj.curseurs = out;
  }

  if (c.envies !== undefined) {
    if (typeof c.envies !== 'object' || c.envies === null) throw Erreurs.requeteInvalide('"envies" doit être un objet.');
    const src = c.envies as Record<string, unknown>;
    const out: Partial<Record<(typeof ENVIE_CLES)[number], number>> = {};
    for (const cle of Object.keys(src)) {
      if (!(ENVIE_CLES as readonly string[]).includes(cle)) throw Erreurs.requeteInvalide(`Envie inconnue : ${cle}.`);
      out[cle as (typeof ENVIE_CLES)[number]] = exigerUnitaire(src[cle], `envies.${cle}`);
    }
    maj.envies = out;
  }

  if (c.cap_nord !== undefined) maj.cap_nord = exigerUnitaire(c.cap_nord, 'cap_nord');

  return maj;
}

/** Fusionne un profil partiel sur un profil courant, champ par champ (deep sur curseurs/envies). Pure. */
export function fusionnerProfil(courant: PhilosophieProfil, maj: PhilosophieMajInput): PhilosophieProfil {
  return {
    curseurs: { ...courant.curseurs, ...(maj.curseurs ?? {}) },
    envies: { ...courant.envies, ...(maj.envies ?? {}) },
    cap_nord: maj.cap_nord ?? courant.cap_nord,
  };
}

/**
 * Mappe un profil vers la signature d'objectif du composeur (le SENS, note 04, validé live M508).
 * Directionnel ; formule exacte (orness/THEME_W/renorm) = v3.1. Nouveauté/Tempo n'agissent pas (actifLive=false).
 * Pure.
 */
export function profilVersSignature(profil: PhilosophieProfil): SignatureComposeur {
  const c = profil.curseurs;
  const capNord = profil.cap_nord ?? 0.5;
  const nature = 1 - c.registre;   // registre 0=nature → nature=1 ; 1=culture → nature=0
  return {
    w_nat: nature,
    w_gra: nature,               // la grandeur des paysages suit l'appétit nature
    w_tra: c.foule,              // hors-sentiers → calme et solitude (f3)
    w_ran: c.effort,             // sportif → randonnée (f4)
    w_biv: c.nuit,               // autonomie → bivouac (f5)
    w_inc: 1 - c.foule,          // iconique → incontournables
    anti_foule: c.foule,         // hors-sentiers → pénalise la foule
    autonomie: c.nuit,
    biais_nord: capNord,         // cap au nord (lat_norm)
    cadence: 1 + 2 * (1 - c.rythme),   // contemplation(0)→3 nuits/base ; découverte(1)→1
    cap_hard_h: 3 + 2 * c.rythme,      // découverte → conduit plus (3→5 h/j)
    themes: {
      paysage: profil.envies.paysage,
      rando: profil.envies.rando,
      nautique: profil.envies.nautique,
      culturel: profil.envies.culturel,
    },
  };
}

/** Le catalogue (libellés A159) + le profil courant (ou défaut) + la version, pour le porteur du lien. */
export async function lirePhilosophie(code: string, rpc = appelerRpc): Promise<PhilosophieReponse> {
  const res = await rpc<PhilosophieReponse | null>('philosophie_lire', [argTexte(code)]);
  if (res === null) throw new ErreurRequete(404, 'lien_non_reconnu', 'Lien non reconnu.');
  return res;
}

/**
 * Écrit une nouvelle version du profil du voyageur porteur du lien. Gaté capacité `voter` (autorité serveur).
 * Fusionne le partiel sur le courant, puis persiste le profil COMPLET (une vérité par voyageur). Rend l'état à jour.
 */
export async function ecrirePhilosophie(code: string, maj: PhilosophieMajInput, rpc = appelerRpc): Promise<PhilosophieReponse> {
  const qui = await lireWhoami(code, rpc);
  exigerCapacite(qui.role, 'voter');

  const courant = await lirePhilosophie(code, rpc);
  const profil = fusionnerProfil(courant.profil, maj);

  const res = await rpc<{ version?: number; erreur?: string }>('philosophie_ecrire', [argTexte(code), argJsonb(profil)]);
  if (res?.erreur) throw Erreurs.requeteInvalide(`Écriture refusée : ${res.erreur}.`);

  return { catalogue: courant.catalogue, profil, version: res?.version };
}

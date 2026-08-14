// Service machine à crans (A18, M047) : l'engine de transitions (PUR, testable sans DB) + l'orchestration flip-ready
// (charge l'état DB2, applique l'engine, persiste). Ne connaît pas Express. Gardes de rôle : seul l'organisateur mute.
//
// La persistance DB2 (RPC api.parcours_lire / api.parcours_enregistrer) se câble au flip (DSN) ; l'engine, lui, est
// complet et testé maintenant. La POLITIQUE (gele, reouvrable) est lue depuis l'état (donnée), jamais codée en dur.

import { appelerRpc, argBigint, argJsonb, argTexte } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import { estOrganisateur } from '../domain/parcours.js';
import type { ActionCran, Cran, CranId, EtatParcours, TransitionResult } from '../domain/parcours.js';

/** Contexte d'une transition : qui la demande, quand. Purs paramètres (pas de Date.now dans l'engine). */
export interface ContexteTransition {
  role: string;
  par: number;
  maintenant: string;
}

function refus(raison: string): TransitionResult {
  return { ok: false, raison };
}

/** Le cran courant = premier cran en brouillon (par ordre), sinon le dernier cran. */
function cranCourant(crans: Cran[]): CranId {
  const tries = [...crans].sort((a, b) => a.ordre - b.ordre);
  if (tries.length === 0) throw Erreurs.requeteInvalide('État de parcours invalide : aucun cran.');
  const premierBrouillon = tries.find((c) => c.etat === 'brouillon');
  return premierBrouillon?.id ?? tries[tries.length - 1]!.id;
}

/**
 * Applique une transition à un état de parcours. PUR : ne mute pas l'entrée, rend un nouvel état (ou un refus métier).
 * Règles (M047) : garde de rôle organisateur ; valider exige l'amont validé ; rouvrir un cran modifiable invalide
 * l'aval modifiable ; un cran `valide_verrouille` non `reouvrable` refuse la réouverture ; l'aval verrouillé n'est
 * jamais invalidé en silence (fait extérieur préservé).
 */
export function appliquerTransition(
  etat: EtatParcours,
  action: ActionCran,
  cranId: CranId,
  ctx: ContexteTransition,
): TransitionResult {
  if (!estOrganisateur(ctx.role)) {
    return refus('Rôle insuffisant : seul un organisateur peut faire évoluer un cran.');
  }
  const crans = etat.crans.map((c) => ({ ...c, gele: [...c.gele] }));
  const cible = crans.find((c) => c.id === cranId);
  if (cible === undefined) return refus('Cran inconnu.');

  if (action === 'valider') {
    if (cible.etat !== 'brouillon') return refus('Ce cran est déjà validé.');
    const amontNonValide = crans.some((c) => c.ordre < cible.ordre && c.etat === 'brouillon');
    if (amontNonValide) return refus('Un cran amont n’est pas encore validé : valide-les dans l’ordre.');
    // Un cran irréversible (reouvrable:false — ferry, paiement, dates, trajet A/R, réservation confirmée) se fige
    // dès sa validation (valide_verrouille) ; un cran modifiable reste rouvrable (M048).
    cible.etat = cible.reouvrable ? 'valide_modifiable' : 'valide_verrouille';
    cible.valide_at = ctx.maintenant;
    cible.valide_par = ctx.par;
  } else if (action === 'verrouiller') {
    if (cible.etat === 'brouillon') return refus('On ne verrouille qu’un cran déjà validé.');
    if (cible.etat === 'valide_verrouille') return refus('Ce cran est déjà verrouillé.');
    // Verrouiller n'écrase PAS valide_at/valide_par : l'audit de validation d'origine (qui, quand) est conservé ;
    // le verrouillage est un changement d'état, pas une revalidation.
    cible.etat = 'valide_verrouille';
  } else {
    // rouvrir
    if (cible.etat === 'brouillon') return refus('Ce cran n’est pas validé : rien à rouvrir.');
    // Un cran irréversible ne se rouvre JAMAIS, quel que soit son état, PIN ou non (M048 §7.4).
    if (!cible.reouvrable) {
      return refus('Ce cran est irréversible (ferry, paiement, dates, trajet aller/retour) : non rouvrable.');
    }
    cible.etat = 'brouillon';
    cible.valide_at = null;
    cible.valide_par = null;
    // Invalide l'aval MODIFIABLE (à recomputer) ; laisse intact l'aval verrouillé (fait extérieur).
    const avalInvalide: CranId[] = [];
    for (const c of crans) {
      if (c.ordre > cible.ordre && c.etat === 'valide_modifiable') {
        c.etat = 'brouillon';
        c.valide_at = null;
        c.valide_par = null;
        avalInvalide.push(c.id);
      }
    }
    const etatRouvert: EtatParcours = { ...etat, crans, cran_courant: cible.id };
    return { ok: true, etat: etatRouvert, aval_invalide: avalInvalide };
  }

  return { ok: true, etat: { ...etat, crans, cran_courant: cranCourant(crans) } };
}

// --- Orchestration flip-ready (persistance DB2 câblée au DSN) -------------------------------------------------

/** Charge l'état de parcours d'un voyage depuis DB2 (RPC posée au flip). Passe-plat. */
export async function lireParcours(voyageId: number): Promise<EtatParcours> {
  return appelerRpc<EtatParcours>('parcours_lire', [argBigint(voyageId)]);
}

/**
 * Charge, applique l'engine, persiste le nouvel état (RPC posée au flip). L'engine (métier pur) tranche AVANT toute
 * écriture ; la persistance `parcours_enregistrer` VÉRIFIE le PIN organisateur côté serveur (autorité serveur, M048
 * §7.4) sur les transitions mutantes. Le PIN ne circule que vers la RPC, jamais dans l'état ni la réponse.
 */
export async function transiterParcours(
  voyageId: number,
  action: ActionCran,
  cranId: CranId,
  pin: string,
  ctx: ContexteTransition,
): Promise<TransitionResult> {
  const etat = await lireParcours(voyageId);
  const resultat = appliquerTransition(etat, action, cranId, ctx);
  if (!resultat.ok || resultat.etat === undefined) return resultat; // refus métier : aucune écriture, aucun PIN requis
  // La RPC gate le PIN (transition mutante) avant d'écrire ; un PIN faux => refus (pas d'écriture).
  const persist = await appelerRpc<{ ok: boolean; error?: string }>('parcours_enregistrer', [
    argBigint(voyageId),
    argJsonb(resultat.etat),
    argBigint(ctx.par),
    argTexte(pin),
  ]);
  if (persist?.ok === false) return refus(persist.error ?? 'PIN organisateur invalide.');
  return resultat;
}

/** Valide et normalise le corps d'une transition (code + pin + action + cran). Pure, testable sans DB.
 *  Le PIN gate toute transition mutante (M048 §7.4) ; il est vérifié côté serveur, jamais renvoyé. */
export function validerTransition(corps: unknown): { code: string; pin: string; action: ActionCran; cran: CranId } {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  if (typeof c.code !== 'string' || c.code.trim() === '') {
    throw Erreurs.requeteInvalide('Champ requis manquant ou vide : code (lien du demandeur).');
  }
  if (typeof c.pin !== 'string' || c.pin.trim() === '') {
    throw Erreurs.requeteInvalide('Champ requis manquant ou vide : pin (organisateur).');
  }
  if (c.action !== 'valider' && c.action !== 'verrouiller' && c.action !== 'rouvrir') {
    throw Erreurs.requeteInvalide('Action invalide : attendu valider, verrouiller ou rouvrir.');
  }
  if (typeof c.cran !== 'string' || c.cran.trim() === '') {
    throw Erreurs.requeteInvalide('Champ requis manquant ou vide : cran.');
  }
  return { code: c.code, pin: c.pin, action: c.action, cran: c.cran as CranId };
}

/** Valide l'identifiant de voyage d'URL : entier positif sûr. Pure. */
export function parseVoyageId(brut: string): number {
  const id = Number(brut);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Erreurs.requeteInvalide(`Identifiant de voyage invalide : ${brut}. Attendu un entier positif.`);
  }
  return id;
}

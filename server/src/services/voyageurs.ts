// Service admin des voyageurs (T039, M074/M077) : lire la tribu, changer un rôle, régénérer un lien. Données
// PRÉCIEUSES (identité, rôles, liens : jamais dans la sync B-15). Ne connaît pas Express. AUTORITÉ SERVEUR avec la
// carte partagée `peut()` (capacité `administrer_voyageurs`, M077) : le rôle du demandeur est résolu par whoami =
// source unique (M052) ; les mutations vérifient EN PLUS le PIN côté RPC (comme parcours_enregistrer). L'orchestration
// DB2 est flip-ready : logique + gardes complètes et testées ; les RPC api.voyageur* se jouent au flip (migration 007).
//
// IDENTITÉ DU DEMANDEUR (à confirmer M, B041) : le corps partagé DemandeRole/DemandeRegenererLien ne porte PAS le
// `code` (M077). Le PIN seul n'identifie pas sûrement (PIN courts). On résout donc le demandeur par son `code` de lien,
// passé en paramètre de route (convention app `/app/<code>/`, comme /exploration/:code). C matche cette forme.

import { appelerRpc, argBigint, argTexte } from '../db/rpc.js';
import { Erreurs, ErreurRequete, exigerPresent } from '../http/erreurs.js';
import { lireWhoami } from './identite.js';
import { parseVoyageId } from './parcours.js';
import { versVoyageur, estRoleAttribuable, peut } from '../domain/voyageurs.js';
import type { Role, Capacite, DemandeRole, DemandeRegenererLien, MembreBrut, Voyageur } from '../domain/voyageurs.js';

export { parseVoyageId };

/** Garde d'autorité : le rôle (déjà normalisé par whoami, M052) porte-t-il la capacité ? Lève 403 sinon. Pure. */
export function exigerCapacite(role: string, capacite: Capacite): void {
  if (!peut(role as Role, capacite)) throw Erreurs.roleInsuffisant();
}

function exigerTexte(v: unknown, nom: string): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw Erreurs.requeteInvalide(`Champ requis manquant ou vide : ${nom}.`);
  }
  return v;
}

function exigerMembreId(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) <= 0) {
    throw Erreurs.requeteInvalide('membre_id doit être un entier positif (la cible de l’action).');
  }
  return v as number;
}

/** Valide le corps partagé DemandeRole { membre_id (cible), role (attribuable), pin }. Pure. Rejette le principal. */
export function validerDemandeRole(corps: unknown): DemandeRole {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  const role = exigerTexte(c.role, 'role');
  if (!estRoleAttribuable(role)) {
    throw Erreurs.requeteInvalide('Rôle non attribuable (organisateur_principal est unique ; rôle inconnu refusé).');
  }
  return { membre_id: exigerMembreId(c.membre_id), role, pin: exigerTexte(c.pin, 'pin') };
}

/** Valide le corps partagé DemandeRegenererLien { membre_id (cible), pin }. Pure. */
export function validerDemandeRegenererLien(corps: unknown): DemandeRegenererLien {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  return { membre_id: exigerMembreId(c.membre_id), pin: exigerTexte(c.pin, 'pin') };
}

/** Traduit un refus métier de la RPC ({ok:false,error}) en erreur HTTP : pin/rôle → 403, cible inconnue → 404, sinon 400. */
function refusRpc(error: string | undefined): ErreurRequete {
  const e = (error ?? '').toLowerCase();
  if (e.includes('pin') || e.includes('rôle') || e.includes('role')) return Erreurs.roleInsuffisant(error);
  if (e.includes('inconnu') || e.includes('introuvable')) return Erreurs.requeteInvalide(error ?? 'Voyageur introuvable.');
  return Erreurs.requeteInvalide(error ?? 'Action refusée.');
}

// --- Orchestration flip-ready (RPC câblées au DSN) -----------------------------------------------------------

/** Liste la tribu d'un voyage (capacité administrer_voyageurs). Le demandeur prouve son rôle par son lien (whoami). */
export async function lireVoyageurs(voyageId: number, codeDemandeur: string): Promise<Voyageur[]> {
  const qui = await lireWhoami(codeDemandeur);
  exigerCapacite(qui.role, 'administrer_voyageurs');
  const lignes = await appelerRpc<MembreBrut[] | null>('voyageurs_lire', [argBigint(voyageId)]);
  return (lignes ?? []).map(versVoyageur);
}

/** Change le rôle d'un voyageur cible. Autorité BFF (peut) ; la RPC RE-vérifie organisateur + PIN (autorité serveur). */
export async function changerRole(voyageId: number, codeDemandeur: string, d: DemandeRole): Promise<Voyageur> {
  const qui = await lireWhoami(codeDemandeur);
  exigerCapacite(qui.role, 'administrer_voyageurs');
  const res = await appelerRpc<{ ok: boolean; error?: string; membre?: MembreBrut }>('voyageur_role_changer', [
    argBigint(voyageId),
    argBigint(d.membre_id),
    argTexte(d.role),
    argTexte(codeDemandeur),
    argTexte(d.pin),
  ]);
  if (!res?.ok) throw refusRpc(res?.error);
  return versVoyageur(exigerPresent(res.membre, () => Erreurs.requeteInvalide('Voyageur cible introuvable.')));
}

/** Régénère le lien perso d'un voyageur cible (nouveau code, ancien invalidé). Idempotent via l'en-tête d'idempotence. */
export async function regenererLien(
  voyageId: number,
  codeDemandeur: string,
  d: DemandeRegenererLien,
): Promise<Voyageur> {
  const qui = await lireWhoami(codeDemandeur);
  exigerCapacite(qui.role, 'administrer_voyageurs');
  const res = await appelerRpc<{ ok: boolean; error?: string; membre?: MembreBrut }>('voyageur_lien_regenerer', [
    argBigint(voyageId),
    argBigint(d.membre_id),
    argTexte(codeDemandeur),
    argTexte(d.pin),
  ]);
  if (!res?.ok) throw refusRpc(res?.error);
  return versVoyageur(exigerPresent(res.membre, () => Erreurs.requeteInvalide('Voyageur cible introuvable.')));
}

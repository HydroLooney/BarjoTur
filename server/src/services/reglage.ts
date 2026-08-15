// Service réglages (M361/M363 bloc 1) : GET (liste des Reglage d'une famille) + PUT (écriture gatée capacité + bornes +
// pin). LECTURE ouverte (C montre valeur/défaut/bornes/capacité) ; ÉCRITURE = autorité serveur (peut() par famille) puis
// RPC `reglage_ecrire` (vérifie pin + bornes + appartenance médicale, écrit budget.parametre — écriture DB2 gatée go
// bascule). RPC injectée (fixtures). Ne connaît pas Express.

import { appelerRpc, argTexte, argJsonb, siRpcAbsente } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import { exigerCapaciteReglage } from '../domain/reglage.js';
import type { FamilleReglage, Reglage, DemandeEcrireReglage, Qualification } from '@barjotur/shared';

/** Contexte du demandeur, résolu par whoami (rôle normalisé, qualification, attribut conducteur) côté route. */
export interface ContexteReglage {
  role: string;
  qualification?: Qualification | null;
  conducteur?: boolean;
}

/** Liste des réglages d'une famille (valeur + défaut + bornes + capacité requise). Passe-plat de api.reglages_lire ;
 *  vide tant que la vue/RPC n'est pas posée (dégradation). */
export async function lireReglages(famille: FamilleReglage, rpc = appelerRpc): Promise<Reglage[]> {
  const res = await siRpcAbsente(rpc<Reglage[] | null>('reglages_lire', [argTexte(famille)]), null);
  return res ?? [];
}

function refusReglage(error?: string): never {
  const e = (error ?? '').toLowerCase();
  if (e.includes('pin') || e.includes('capacit') || e.includes('rôle') || e.includes('role') || e.includes('habilit')) {
    throw Erreurs.roleInsuffisant(error);
  }
  throw Erreurs.requeteInvalide(error ?? 'Réglage refusé.');
}

/** Écrit un réglage : garde de capacité (autorité serveur, 403 si non habilité) puis RPC (pin + bornes + appartenance
 *  médicale côté serveur). L'écriture réelle en budget.parametre reste gatée « go bascule ». */
export async function ecrireReglage(
  famille: FamilleReglage,
  ctx: ContexteReglage,
  code: string,
  demande: DemandeEcrireReglage,
  rpc = appelerRpc,
): Promise<{ ok: true }> {
  exigerCapaciteReglage(famille, ctx.role, ctx.qualification, ctx.conducteur);
  const res = await rpc<{ ok: boolean; error?: string }>('reglage_ecrire', [
    argTexte(code),
    argTexte(famille),
    argTexte(demande.cle),
    argJsonb(demande.valeur),
    argTexte(demande.pin),
  ]);
  if (!res.ok) refusReglage(res.error);
  return { ok: true };
}

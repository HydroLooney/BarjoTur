// Réglages (M361/M363 bloc 1) — partie PURE : validation + GARDE de capacité par famille (autorité serveur). Le service
// passe-plat câble GET/PUT /api/reglages dessus. Gating = shared `peut` + `CAPACITE_PAR_FAMILLE` (composition→organisateurs,
// conduite→conducteurs, profils→principal, medical→personnel). Les valeurs vivent dans `budget.parametre` (écriture DB2
// gatée go bascule) ; ici on valide seulement (bornes + capacité), le RPC écrit.

import { Erreurs } from '../http/erreurs.js';
import {
  peut,
  CAPACITE_PAR_FAMILLE,
  type FamilleReglage,
  type BornesReglage,
  type DemandeEcrireReglage,
  type Role,
  type Qualification,
} from '@barjotur/shared';

const FAMILLES: readonly FamilleReglage[] = ['composition', 'conduite', 'profils', 'medical'];

/** Valide la famille d'URL. Pure. */
export function validerFamille(brut: unknown): FamilleReglage {
  if (typeof brut === 'string' && (FAMILLES as readonly string[]).includes(brut)) return brut as FamilleReglage;
  throw Erreurs.requeteInvalide(
    `Famille de réglage inconnue : ${String(brut)}. Attendu composition|conduite|profils|medical.`,
  );
}

/** Valide le corps `DemandeEcrireReglage { cle, valeur, pin }`. Pure. */
export function validerDemandeEcrireReglage(body: unknown): DemandeEcrireReglage {
  const c = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof c.cle !== 'string' || c.cle.trim() === '') throw Erreurs.requeteInvalide('Réglage : `cle` requise.');
  if (c.valeur === undefined || c.valeur === null) throw Erreurs.requeteInvalide('Réglage : `valeur` requise.');
  if (typeof c.pin !== 'string' || c.pin.trim() === '') throw Erreurs.requeteInvalide('Réglage : `pin` requis.');
  return { cle: c.cle, valeur: c.valeur as DemandeEcrireReglage['valeur'], pin: c.pin };
}

/** Vrai si `valeur` respecte les bornes (bornes absentes ou valeur non numérique sans bornes → permis). Pure. */
export function dansLesBornes(valeur: unknown, bornes?: BornesReglage): boolean {
  if (bornes === undefined) return true;
  if (typeof valeur !== 'number') return true;
  if (bornes.min !== undefined && valeur < bornes.min) return false;
  if (bornes.max !== undefined && valeur > bornes.max) return false;
  return true;
}

/** Garde d'autorité : le demandeur peut-il éditer cette famille ? `medical` = personnel (appartenance vérifiée par le
 *  lien, pas une capacité de rôle) → ne bloque pas ici. Sinon lève 403 si `peut()` refuse. Pure. */
export function exigerCapaciteReglage(
  famille: FamilleReglage,
  role: string,
  qualification?: Qualification | null,
  conducteur?: boolean,
): void {
  const cap = CAPACITE_PAR_FAMILLE[famille];
  if (cap === null) return;
  if (!peut(role as Role, cap, qualification, conducteur)) throw Erreurs.roleInsuffisant();
}

import type { Cran, CranId, EtatParcours, Role, TransitionCran, TransitionResult } from '@barjotur/shared';

// Machine à crans du parcours (A18), côté front : logique PURE et GÉNÉRIQUE. On lit la structure et
// `Cran.reouvrable` ; on ne code AUCUNE politique métier en dur (quel cran gèle quoi, verrouillages
// définitifs) : c'est de la config/donnée (différée A18 §6). Sert au mode fixture (flip live=off) et de
// miroir optimiste ; l'autorité reste le backend quand il répond (même contrat `TransitionResult`).

/** Seul l'organisateur (principal ou délégué) fait évoluer le parcours (A03/C05). */
export function estOrganisateur(role: Role | null): boolean {
  return role === 'organisateur_principal' || role === 'organisateur';
}

/** Crans strictement en aval (ordre supérieur) d'un cran, ordonnés. */
export function avalDe(crans: Cran[], cranId: CranId): Cran[] {
  const ref = crans.find((c) => c.id === cranId);
  if (!ref) return [];
  return crans.filter((c) => c.ordre > ref.ordre).sort((a, b) => a.ordre - b.ordre);
}

/** Le cran courant = premier cran encore en brouillon (ou le dernier si tout est validé). */
export function premierNonValide(crans: Cran[], repli: CranId): CranId {
  const ordonnes = [...crans].sort((a, b) => a.ordre - b.ordre);
  const brouillon = ordonnes.find((c) => c.etat === 'brouillon');
  if (brouillon) return brouillon.id;
  const dernier = ordonnes[ordonnes.length - 1];
  return dernier ? dernier.id : repli;
}

/**
 * Applique une transition LOCALEMENT (mode fixture). Générique :
 * - `valider` : brouillon → valide_modifiable (cadenas ouvert).
 * - `verrouiller` : → valide_verrouille (cadenas fermé, fait extérieur).
 * - `rouvrir` : validé → brouillon, SI `reouvrable` ; invalide l'aval réouvrable (aval_invalide).
 * Un cran aval verrouillé et NON réouvrable n'est jamais réinitialisé (fait extérieur, ex. paiement).
 */
export function appliquerTransition(
  etat: EtatParcours,
  t: TransitionCran,
  role: Role | null,
): TransitionResult {
  if (!estOrganisateur(role)) {
    return { ok: false, raison: 'Seul un organisateur peut faire évoluer le parcours.' };
  }
  const crans = etat.crans.map((c) => ({ ...c }));
  const cible = crans.find((c) => c.id === t.cran);
  if (!cible) return { ok: false, raison: 'Cran inconnu.' };

  if (t.action === 'valider') {
    if (cible.etat !== 'brouillon') return { ok: false, raison: 'Ce cran est déjà validé.' };
    // Fidèle à l'engine autoritatif (B033) : un cran irréversible se fige DIRECTEMENT en verrouillé
    // à la validation (réservation/ferry/dates/A-R) ; un cran modifiable devient rouvrable.
    cible.etat = cible.reouvrable ? 'valide_modifiable' : 'valide_verrouille';
    return { ok: true, etat: { ...etat, crans, cran_courant: premierNonValide(crans, etat.cran_courant) } };
  }

  if (t.action === 'verrouiller') {
    if (cible.etat === 'brouillon') return { ok: false, raison: 'Validez ce cran avant de le verrouiller.' };
    if (cible.etat === 'valide_verrouille') return { ok: false, raison: 'Ce cran est déjà verrouillé.' };
    cible.etat = 'valide_verrouille';
    return { ok: true, etat: { ...etat, crans, cran_courant: premierNonValide(crans, etat.cran_courant) } };
  }

  // rouvrir
  if (cible.etat === 'brouillon') return { ok: false, raison: 'Ce cran est déjà ouvert.' };
  if (cible.etat === 'valide_verrouille' && !cible.reouvrable) {
    return { ok: false, raison: 'Ce cran est verrouillé définitivement (fait extérieur).' };
  }
  cible.etat = 'brouillon';
  const aval = avalDe(crans, t.cran).filter(
    (c) => c.etat !== 'brouillon' && (c.etat === 'valide_modifiable' || c.reouvrable),
  );
  for (const c of aval) c.etat = 'brouillon';
  return {
    ok: true,
    etat: { ...etat, crans, cran_courant: t.cran },
    aval_invalide: aval.map((c) => c.id),
  };
}

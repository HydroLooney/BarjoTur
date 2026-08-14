import { describe, expect, it } from 'vitest';
import type { Cran, CranId, EtatParcours, EtatValidation } from '@barjotur/shared';
import { appliquerTransition, avalDe, estOrganisateur, premierNonValide } from './parcours';

function cran(id: CranId, ordre: number, etat: EtatValidation, reouvrable = true): Cran {
  return { id, libelle: id, ordre, etat, gele: [], reouvrable, valide_at: null, valide_par: null };
}

function etat(crans: Cran[], courant: CranId = 'cadrage'): EtatParcours {
  return { voyage_id: 1, crans, cran_courant: courant };
}

describe('estOrganisateur', () => {
  it('vrai pour organisateur principal et délégué, faux sinon', () => {
    expect(estOrganisateur('organisateur_principal')).toBe(true);
    expect(estOrganisateur('organisateur')).toBe(true);
    expect(estOrganisateur('voyageur')).toBe(false);
    expect(estOrganisateur(null)).toBe(false);
  });
});

describe('avalDe', () => {
  it("retourne les crans d'ordre supérieur, ordonnés", () => {
    const crans = [cran('cadrage', 1, 'brouillon'), cran('exploration', 3, 'brouillon'), cran('composition', 4, 'brouillon')];
    expect(avalDe(crans, 'cadrage').map((c) => c.id)).toEqual(['exploration', 'composition']);
    expect(avalDe(crans, 'composition')).toEqual([]);
  });
});

describe('premierNonValide', () => {
  it('rend le premier brouillon, sinon le dernier cran', () => {
    const crans = [cran('cadrage', 1, 'valide_modifiable'), cran('exploration', 2, 'brouillon')];
    expect(premierNonValide(crans, 'cadrage')).toBe('exploration');
    const tousValides = [cran('cadrage', 1, 'valide_verrouille'), cran('exploration', 2, 'valide_modifiable')];
    expect(premierNonValide(tousValides, 'cadrage')).toBe('exploration');
  });
});

describe('appliquerTransition', () => {
  const base = () =>
    etat([
      cran('cadrage', 1, 'valide_modifiable'),
      cran('reservation_van', 2, 'brouillon'),
      cran('exploration', 3, 'brouillon'),
    ]);

  it('refuse toute transition à un non-organisateur', () => {
    const r = appliquerTransition(base(), { voyage_id: 1, cran: 'reservation_van', action: 'valider' }, 'voyageur');
    expect(r.ok).toBe(false);
    expect(r.raison).toMatch(/organisateur/i);
  });

  it('valide un brouillon en valide_modifiable et avance le cran courant', () => {
    const r = appliquerTransition(base(), { voyage_id: 1, cran: 'reservation_van', action: 'valider' }, 'organisateur');
    expect(r.ok).toBe(true);
    expect(r.etat?.crans.find((c) => c.id === 'reservation_van')?.etat).toBe('valide_modifiable');
    expect(r.etat?.cran_courant).toBe('exploration');
  });

  it('fige directement en verrouillé un cran irréversible validé (fidèle à l’engine B)', () => {
    const e = etat([cran('reservation_van', 2, 'brouillon', false)]);
    const r = appliquerTransition(e, { voyage_id: 1, cran: 'reservation_van', action: 'valider' }, 'organisateur');
    expect(r.ok).toBe(true);
    expect(r.etat?.crans.find((c) => c.id === 'reservation_van')?.etat).toBe('valide_verrouille');
  });

  it('refuse de valider un cran déjà validé', () => {
    const r = appliquerTransition(base(), { voyage_id: 1, cran: 'cadrage', action: 'valider' }, 'organisateur');
    expect(r.ok).toBe(false);
  });

  it('rouvre un cran modifiable et invalide l’aval déjà validé', () => {
    const e = etat([
      cran('cadrage', 1, 'valide_modifiable'),
      cran('reservation_van', 2, 'valide_modifiable'),
      cran('exploration', 3, 'valide_modifiable'),
    ]);
    const r = appliquerTransition(e, { voyage_id: 1, cran: 'cadrage', action: 'rouvrir' }, 'organisateur_principal');
    expect(r.ok).toBe(true);
    expect(r.etat?.crans.find((c) => c.id === 'cadrage')?.etat).toBe('brouillon');
    expect(r.aval_invalide).toEqual(['reservation_van', 'exploration']);
    expect(r.etat?.cran_courant).toBe('cadrage');
  });

  it('préserve un cran aval verrouillé NON réouvrable lors d’une réouverture amont', () => {
    const e = etat([
      cran('cadrage', 1, 'valide_modifiable'),
      cran('reservation_van', 2, 'valide_verrouille', false), // paiement, définitif
    ]);
    const r = appliquerTransition(e, { voyage_id: 1, cran: 'cadrage', action: 'rouvrir' }, 'organisateur');
    expect(r.ok).toBe(true);
    expect(r.aval_invalide).toEqual([]);
    expect(r.etat?.crans.find((c) => c.id === 'reservation_van')?.etat).toBe('valide_verrouille');
  });

  it('refuse de rouvrir un cran verrouillé définitivement', () => {
    const e = etat([cran('reservation_van', 2, 'valide_verrouille', false)]);
    const r = appliquerTransition(e, { voyage_id: 1, cran: 'reservation_van', action: 'rouvrir' }, 'organisateur');
    expect(r.ok).toBe(false);
    expect(r.raison).toMatch(/définitiv/i);
  });
});

import { describe, expect, it } from 'vitest';
import type { BudgetComparatif } from '@barjotur/shared';
import { amplitudeEcart, classerProfils, ecartAuConsensus, natureDe, nomProfil } from './comparateur';

// Fabrique une ligne de budget comparatif minimale pour les tests (seuls les champs lus comptent).
function ligne(partial: Partial<BudgetComparatif>): BudgetComparatif {
  return {
    fige_id: null,
    code: null,
    label: null,
    source: 'membre',
    archetype_key: null,
    prenom: null,
    km: 0,
    nuits: 0,
    postes: {
      van: 0,
      activites: 0,
      carburant: 0,
      hebergement: 0,
      repas_courses: 0,
      ferry_interieur: 0,
      ferry_international: 0,
    },
    par_adulte: { note: '', nb_adultes: 2, prudent_eur: 0, non_prudent_eur: 0 },
    alertes: {
      hard_cap_eur: 0,
      soft_cap_eur: 0,
      depasse_hard_prudent: false,
      depasse_soft_prudent: false,
      depasse_hard_non_prudent: false,
      depasse_soft_non_prudent: false,
    },
    total_prudent_eur: 0,
    total_non_prudent_eur: 0,
    ...partial,
  };
}

describe('natureDe', () => {
  it('reconnaît le consensus par sa source', () => {
    expect(natureDe(ligne({ source: 'consensus' }))).toBe('consensus');
  });
  it('reconnaît un archétype par sa clé', () => {
    expect(natureDe(ligne({ source: 'archetype', archetype_key: 'sportif' }))).toBe('archetype');
  });
  it('reconnaît un membre par son prénom', () => {
    expect(natureDe(ligne({ source: 'membre', prenom: 'Alix' }))).toBe('membre');
  });
});

describe('nomProfil', () => {
  it('privilégie le prénom, puis le libellé, puis la clé', () => {
    expect(nomProfil(ligne({ prenom: 'Alix', label: 'x', archetype_key: 'y' }))).toBe('Alix');
    expect(nomProfil(ligne({ prenom: null, label: 'Retenu', archetype_key: 'y' }))).toBe('Retenu');
    expect(nomProfil(ligne({ prenom: null, label: null, archetype_key: 'sportif' }))).toBe('sportif');
    expect(nomProfil(ligne({ prenom: null, label: null, archetype_key: null, source: 'consensus' }))).toBe('Consensus');
  });
});

describe('classerProfils', () => {
  it('répartit consensus, membres et archétypes', () => {
    const lignes = [
      ligne({ source: 'consensus' }),
      ligne({ source: 'membre', prenom: 'Alix' }),
      ligne({ source: 'membre', prenom: 'Bo' }),
      ligne({ source: 'archetype', archetype_key: 'sportif' }),
    ];
    const { consensus, membres, archetypes } = classerProfils(lignes);
    expect(consensus?.nature).toBe('consensus');
    expect(membres.map((m) => m.nom)).toEqual(['Alix', 'Bo']);
    expect(archetypes).toHaveLength(1);
  });
  it('rend un consensus null si absent', () => {
    expect(classerProfils([ligne({ source: 'membre', prenom: 'Alix' })]).consensus).toBeNull();
  });
});

describe('ecartAuConsensus', () => {
  it('signe positif quand le profil dépasse le consensus', () => {
    const c = ligne({ km: 1000, nuits: 20, total_prudent_eur: 5000 });
    const m = ligne({ km: 1300, nuits: 22, total_prudent_eur: 5600 });
    expect(ecartAuConsensus(m, c)).toEqual({ dKm: 300, dNuits: 2, dBudget: 600 });
  });
  it('signe négatif quand le profil est en deçà', () => {
    const c = ligne({ km: 1000, nuits: 20, total_prudent_eur: 5000 });
    const m = ligne({ km: 800, nuits: 18, total_prudent_eur: 4700 });
    expect(ecartAuConsensus(m, c)).toEqual({ dKm: -200, dNuits: -2, dBudget: -300 });
  });
});

describe('amplitudeEcart', () => {
  it("classe plus haut l'écart le plus large (celui qui cède le plus)", () => {
    const petit = amplitudeEcart({ dKm: 100, dNuits: 0, dBudget: 100 }); // 0 + 1 + 1 = 2
    const grand = amplitudeEcart({ dKm: -400, dNuits: 3, dBudget: -200 }); // 3 + 4 + 2 = 9
    expect(grand).toBeGreaterThan(petit);
  });
});

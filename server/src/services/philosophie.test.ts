// TDD (M004) : logique pure de la philosophie — validation du partiel, fusion, mapping du sens vers la signature.
// Sans DB ni Express. Contrat = shared 3c46a57 (M508, crible B159).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerMajProfil, fusionnerProfil, profilVersSignature } from './philosophie.js';
import { ErreurRequete } from '../http/erreurs.js';
import type { PhilosophieProfil } from '../domain/philosophie.js';

const PROFIL_DEFAUT: PhilosophieProfil = {
  curseurs: { rythme: 0.5, registre: 0.5, nuit: 0.5, foule: 0.5, nouveaute: 0.5, effort: 0.5, tempo: 0.5 },
  envies: { paysage: 0.5, rando: 0.5, nautique: 0.5, culturel: 0.5 },
  cap_nord: 0.5,
};

// --- validerMajProfil ---

test('validerMajProfil accepte un partiel valide', () => {
  const m = validerMajProfil({ curseurs: { registre: 0.2 }, envies: { rando: 0.9 }, cap_nord: 0.7 });
  assert.equal(m.curseurs?.registre, 0.2);
  assert.equal(m.envies?.rando, 0.9);
  assert.equal(m.cap_nord, 0.7);
});

test('validerMajProfil accepte un corps vide (aucun changement)', () => {
  assert.deepEqual(validerMajProfil({}), {});
});

test('validerMajProfil rejette une clé de curseur inconnue', () => {
  assert.throws(() => validerMajProfil({ curseurs: { inconnu: 0.5 } }), ErreurRequete);
});

test('validerMajProfil rejette une envie inconnue', () => {
  assert.throws(() => validerMajProfil({ envies: { gastronomie: 0.5 } }), ErreurRequete);
});

test('validerMajProfil rejette une valeur hors [0,1]', () => {
  assert.throws(() => validerMajProfil({ curseurs: { foule: 1.5 } }), ErreurRequete);
  assert.throws(() => validerMajProfil({ curseurs: { foule: -0.1 } }), ErreurRequete);
  assert.throws(() => validerMajProfil({ cap_nord: 2 }), ErreurRequete);
  assert.throws(() => validerMajProfil({ envies: { rando: 'haut' } }), ErreurRequete);
});

test('validerMajProfil rejette un corps non-objet', () => {
  assert.throws(() => validerMajProfil(null), ErreurRequete);
  assert.throws(() => validerMajProfil([1]), ErreurRequete);
});

// --- fusionnerProfil ---

test('fusionnerProfil applique le partiel et garde le reste', () => {
  const f = fusionnerProfil(PROFIL_DEFAUT, { curseurs: { registre: 0.1 }, envies: { culturel: 0.8 } });
  assert.equal(f.curseurs.registre, 0.1);
  assert.equal(f.curseurs.rythme, 0.5, 'un curseur non touché garde sa valeur');
  assert.equal(f.envies.culturel, 0.8);
  assert.equal(f.envies.paysage, 0.5);
  assert.equal(f.cap_nord, 0.5, 'cap_nord non touché garde sa valeur');
});

// --- profilVersSignature (le SENS, note 04) ---

test('profilVersSignature : registre=0 (nature) → w_nat/w_gra max', () => {
  const s = profilVersSignature({ ...PROFIL_DEFAUT, curseurs: { ...PROFIL_DEFAUT.curseurs, registre: 0 } });
  assert.equal(s.w_nat, 1);
  assert.equal(s.w_gra, 1);
});

test('profilVersSignature : foule=1 (hors-sentiers) → anti_foule max, incontournables nuls', () => {
  const s = profilVersSignature({ ...PROFIL_DEFAUT, curseurs: { ...PROFIL_DEFAUT.curseurs, foule: 1 } });
  assert.equal(s.anti_foule, 1);
  assert.equal(s.w_tra, 1);
  assert.equal(s.w_inc, 0);
});

test('profilVersSignature : rythme borne la cadence et le cap conduite', () => {
  const lent = profilVersSignature({ ...PROFIL_DEFAUT, curseurs: { ...PROFIL_DEFAUT.curseurs, rythme: 0 } });
  assert.equal(lent.cadence, 3, 'contemplation → 3 nuits/base');
  assert.equal(lent.cap_hard_h, 3);
  const vif = profilVersSignature({ ...PROFIL_DEFAUT, curseurs: { ...PROFIL_DEFAUT.curseurs, rythme: 1 } });
  assert.equal(vif.cadence, 1, 'découverte → 1 nuit/base');
  assert.equal(vif.cap_hard_h, 5);
});

test('profilVersSignature : nuit→autonomie/bivouac, effort→rando, cap_nord→biais_nord', () => {
  const s = profilVersSignature({
    ...PROFIL_DEFAUT,
    curseurs: { ...PROFIL_DEFAUT.curseurs, nuit: 0.9, effort: 0.8 },
    cap_nord: 0.7,
  });
  assert.equal(s.autonomie, 0.9);
  assert.equal(s.w_biv, 0.9);
  assert.equal(s.w_ran, 0.8);
  assert.equal(s.biais_nord, 0.7);
});

test('profilVersSignature : les 4 envies passent en poids de thème', () => {
  const s = profilVersSignature({ ...PROFIL_DEFAUT, envies: { paysage: 0.1, rando: 0.2, nautique: 0.3, culturel: 0.4 } });
  assert.deepEqual(s.themes, { paysage: 0.1, rando: 0.2, nautique: 0.3, culturel: 0.4 });
});

test('profilVersSignature : cap_nord absent → 0.5 par défaut', () => {
  const { cap_nord: _omit, ...sansCapNord } = PROFIL_DEFAUT;
  const s = profilVersSignature(sansCapNord as PhilosophieProfil);
  assert.equal(s.biais_nord, 0.5);
});

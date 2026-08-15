// TDD (M361/M363 bloc 1) : partie PURE des réglages — valider la famille, les bornes, et la GARDE de capacité par
// famille (autorité serveur). Le service passe-plat (GET/PUT) s'appuie dessus. Gating = shared `peut` + CAPACITE_PAR_FAMILLE.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerFamille, validerDemandeEcrireReglage, dansLesBornes, exigerCapaciteReglage } from './reglage.js';
import { ErreurRequete } from '../http/erreurs.js';

test('validerFamille : composition|conduite|profils|medical, sinon 400', () => {
  for (const f of ['composition', 'conduite', 'profils', 'medical'] as const) assert.equal(validerFamille(f), f);
  assert.throws(() => validerFamille('autre'), ErreurRequete);
  assert.throws(() => validerFamille(42), ErreurRequete);
});

test('validerDemandeEcrireReglage : cle + valeur + pin requis', () => {
  const ok = validerDemandeEcrireReglage({ cle: 'cap_roulage_min', valeur: 240, pin: '1234' });
  assert.deepEqual(ok, { cle: 'cap_roulage_min', valeur: 240, pin: '1234' });
  assert.throws(() => validerDemandeEcrireReglage({ valeur: 1, pin: 'x' }), ErreurRequete); // cle manquante
  assert.throws(() => validerDemandeEcrireReglage({ cle: 'c', valeur: 1 }), ErreurRequete); // pin manquant
});

test('dansLesBornes : respecte min/max (bornes absentes = tout permis)', () => {
  assert.equal(dansLesBornes(240, { min: 60, max: 480 }), true);
  assert.equal(dansLesBornes(500, { min: 60, max: 480 }), false);
  assert.equal(dansLesBornes(30, { min: 60 }), false);
  assert.equal(dansLesBornes('texte', undefined), true); // non numérique sans bornes → permis
});

test('exigerCapaciteReglage : gating par famille (autorité serveur)', () => {
  // composition = organisateurs ; un voyageur simple est refusé, l'organisateur passe.
  assert.throws(() => exigerCapaciteReglage('composition', 'voyageur'), ErreurRequete);
  assert.doesNotThrow(() => exigerCapaciteReglage('composition', 'organisateur'));
  // conduite = conducteur (attribut) + organisateur : sans l'attribut → refus, avec → passe.
  assert.throws(() => exigerCapaciteReglage('conduite', 'organisateur', null, false), ErreurRequete);
  assert.doesNotThrow(() => exigerCapaciteReglage('conduite', 'organisateur', null, true));
  // profils = principal seulement.
  assert.throws(() => exigerCapaciteReglage('profils', 'organisateur'), ErreurRequete);
  assert.doesNotThrow(() => exigerCapaciteReglage('profils', 'organisateur_principal'));
  // medical = personnel (pas une capacité de rôle) : la garde de capacité ne bloque pas (appartenance vérifiée ailleurs).
  assert.doesNotThrow(() => exigerCapaciteReglage('medical', 'voyageur'));
});

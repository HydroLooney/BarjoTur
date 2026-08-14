import type { EtatParcours } from '@barjotur/shared';

// Fixture flip-ready du fil du parcours (A18 / M046). Forme EXACTE du contrat `EtatParcours`, pour bâtir
// et vérifier la machine à crans avant que le backend (B, M047) réponde. États variés à dessein : un cran
// verrouillé définitivement (réservation van payée, `reouvrable:false`) pour éprouver le cas non-réouvrable.
export const parcoursDemo: EtatParcours = {
  voyage_id: 1,
  cran_courant: 'composition',
  crans: [
    {
      id: 'cadrage',
      libelle: 'Cadrage',
      ordre: 1,
      etat: 'valide_modifiable',
      gele: ['duree', 'budget_cap'],
      reouvrable: true,
      valide_at: '2026-07-01T10:00:00Z',
      valide_par: 1,
    },
    {
      id: 'reservation_van',
      libelle: 'Réservation du van',
      ordre: 2,
      etat: 'valide_verrouille',
      gele: ['profil_van'],
      reouvrable: false,
      valide_at: '2026-07-05T09:00:00Z',
      valide_par: 1,
    },
    {
      id: 'exploration',
      libelle: 'Exploration',
      ordre: 3,
      etat: 'valide_modifiable',
      gele: [],
      reouvrable: true,
      valide_at: '2026-07-20T18:00:00Z',
      valide_par: 1,
    },
    { id: 'composition', libelle: 'Composition', ordre: 4, etat: 'brouillon', gele: [], reouvrable: true, valide_at: null, valide_par: null },
    { id: 'logistique', libelle: 'Logistique', ordre: 5, etat: 'brouillon', gele: [], reouvrable: true, valide_at: null, valide_par: null },
    { id: 'depart', libelle: 'Départ', ordre: 6, etat: 'brouillon', gele: [], reouvrable: true, valide_at: null, valide_par: null },
  ],
};

// Machine à crans du voyage (A18) : le cycle de vie « brouillon → validé modifiable → validé verrouillé » par cran.
// La STRUCTURE est canonique dans @barjotur/shared (parcours.ts, M047) : on la réexporte. La POLITIQUE (quels crans,
// dans quel ordre, ce qu'ils gèlent, leur réversibilité) est de la DONNÉE (config), pas une règle en dur — l'esquisse
// A18 §2 ci-dessous est un SEED de départ, remplaçable par une config DB2 au flip (A18 §6 tranché par Guillaume).

export type {
  EtatValidation,
  CranId,
  Cran,
  EtatParcours,
  ActionCran,
  TransitionCran,
  TransitionResult,
} from '@barjotur/shared';

import type { Role } from '@barjotur/shared';
import type { Cran, CranId, EtatParcours } from '@barjotur/shared';

/** Seul un organisateur (principal ou non) fait évoluer un cran (M047, A03). */
export function estOrganisateur(role: string | Role): boolean {
  return role === 'organisateur' || role === 'organisateur_principal';
}

/**
 * SEED des crans d'un voyage neuf (esquisse A18 §2). Politique = donnée : `gele` et `reouvrable` vivent ici,
 * l'engine les LIT, ne les code pas en dur. `reservation_van` et `depart` sont non rouvrables (faits extérieurs :
 * paiement, jour J) ; les autres restent rouvrables au prix d'un recompute de l'aval.
 */
const SEED_CRANS: ReadonlyArray<Omit<Cran, 'etat' | 'valide_at' | 'valide_par'>> = [
  { id: 'cadrage', libelle: 'Cadrage', ordre: 1, gele: [], reouvrable: true },
  { id: 'reservation_van', libelle: 'Réservation du van', ordre: 2, gele: ['profil_van'], reouvrable: false },
  { id: 'exploration', libelle: 'Exploration', ordre: 3, gele: [], reouvrable: true },
  { id: 'composition', libelle: 'Composition', ordre: 4, gele: [], reouvrable: true },
  { id: 'logistique', libelle: 'Logistique', ordre: 5, gele: [], reouvrable: true },
  { id: 'depart', libelle: 'Départ', ordre: 6, gele: [], reouvrable: false },
];

/** Fabrique un état de parcours neuf (tous crans en brouillon) pour un voyage. Le seed est remplaçable par config DB2. */
export function parcoursNeuf(voyageId: number, seed: typeof SEED_CRANS = SEED_CRANS): EtatParcours {
  const crans: Cran[] = seed
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map((c) => ({ ...c, gele: [...c.gele], etat: 'brouillon', valide_at: null, valide_par: null }));
  const courant: CranId = crans[0]?.id ?? 'cadrage';
  return { voyage_id: voyageId, crans, cran_courant: courant };
}

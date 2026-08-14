import type { ComposeInput, ComposeReponse } from '@barjotur/shared';
import { figeGeomDemo } from './fige-demo';

// Fixture flip-ready du compose-launch (M029) : forme EXACTE des contrats shared, pour construire et
// vérifier la coquille avant que le sidecar réponde. Au feu bascule, on bascule le drapeau `live` et cet
// import disparaît. Zéro invention : on ne fait que remplir `ComposeInput` / `ComposeReponse` déjà typés.

export interface BaseCandidate {
  base_id: number;
  nom: string;
}

// Bases candidates de démonstration (le vrai catalogue de bases viendra d'un endpoint au branchement).
export const basesCandidatesDemo: BaseCandidate[] = [
  { base_id: 1, nom: 'Kristiansand' },
  { base_id: 2, nom: 'Stavanger' },
  { base_id: 3, nom: 'Bergen' },
  { base_id: 4, nom: 'Flåm' },
  { base_id: 5, nom: 'Geiranger' },
  { base_id: 6, nom: 'Åndalsnes' },
  { base_id: 7, nom: 'Trondheim' },
  { base_id: 8, nom: 'Lofoten' },
];

// Réponse de composition factice, dérivée de l'entrée (nuits/route cohérents), geom = tracé de démo.
export function composeReponseDemo(input: ComposeInput): ComposeReponse {
  const n = input.bases.length;
  return {
    ok: true,
    compose: { n_bases: n, nuits: n * 2, value: n * 10, drive_h: n * 1.5 },
    n_etapes: n,
    route: [...input.bases],
    // La fixture est un MultiLineString geojson (Position = number[]) ; le contrat shared attend une
    // Position = [number, number]. Structurellement identique, on caste (donnée de démo maîtrisée).
    geom: figeGeomDemo as unknown as ComposeReponse['geom'],
    nights_par_base: Object.fromEntries(input.bases.map((b) => [String(b), 2])),
    nuits_deficit: 0,
  };
}

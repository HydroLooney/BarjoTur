import type { ComposeInput, ComposeReponse, EtapeRoutee } from '@barjotur/shared';
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
// `etapes` = la séquence mixte typée (M062) : transit aller (en attente du corridor) → expérience (routée,
// avec géométrie) → transit retour (en attente). Le tracé transit réel arrive avec le corridor A + sidecar B.
export function composeReponseDemo(input: ComposeInput): ComposeReponse {
  const n = input.bases.length;
  // La fixture est un MultiLineString geojson (Position = number[]) ; le contrat shared attend une
  // Position = [number, number]. Structurellement identique, on caste (donnée de démo maîtrisée).
  const geomExperience = figeGeomDemo as unknown as ComposeReponse['geom'];
  const meta = { n_bases: n, nuits: n * 2, value: n * 10, drive_h: n * 1.5 };
  const etapes: EtapeRoutee[] = [
    { nature: 'transit', ordre: 1, geom: null, statut: 'en_attente_corridor' },
    { nature: 'experience', ordre: 2, geom: geomExperience, meta, statut: 'route' },
    { nature: 'transit', ordre: 3, geom: null, statut: 'en_attente_corridor' },
  ];
  return {
    ok: true,
    compose: meta,
    n_etapes: etapes.length,
    route: [...input.bases],
    geom: geomExperience,
    etapes,
    nights_par_base: Object.fromEntries(input.bases.map((b) => [String(b), 2])),
    nuits_deficit: 0,
  };
}

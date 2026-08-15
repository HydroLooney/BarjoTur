// Modèle du TIER DE SCORE (proéminence algorithmique d'un POI), à 5 crans depuis M334 (re-score v3). DISTINCT des 4
// boutons de vote (Coup de cœur/Vraiment envie/Bien/Pourquoi pas), qui sont l'avis de l'utilisateur. Ici : ce que le
// scoring propose comme importance d'un lieu. Contrat unique consommé par la symbologie de carte (C13), la légende, et
// plus tard l'axe SÉPARÉ de confiance. Distribution cible (M334) : T22 / S155 / A188 / B196 / C223 (~767 POI).

export type TierScore = 'T' | 'S' | 'A' | 'B' | 'C';

export interface CranTier {
  cle: TierScore;
  libelle: string;
  /** Facteur de proéminence [0..1] : T le plus fort (1), C le plus discret. Multiplie la taille du marqueur. */
  prominence: number;
  /** Zoom d'ÉMERGENCE du marqueur individuel : plus il est BAS, plus le tier apparaît tôt et reste longtemps.
   *  C émerge en dernier → il s'agglomère EN PREMIER au dézoom (ordre C→T demandé, M334). */
  emergence: number;
}

// Ordre canonique T→C (du plus fort au plus discret).
export const TIERS_SCORE: CranTier[] = [
  { cle: 'T', libelle: 'Incontournable', prominence: 1.0, emergence: 3.8 },
  { cle: 'S', libelle: 'Majeur', prominence: 0.87, emergence: 5.4 },
  { cle: 'A', libelle: 'Fort', prominence: 0.75, emergence: 6.8 },
  { cle: 'B', libelle: 'Intéressant', prominence: 0.64, emergence: 8.2 },
  { cle: 'C', libelle: 'Secondaire', prominence: 0.55, emergence: 9.4 },
];

const PROMINENCE = Object.fromEntries(TIERS_SCORE.map((t) => [t.cle, t.prominence])) as Record<TierScore, number>;
const EMERGENCE = Object.fromEntries(TIERS_SCORE.map((t) => [t.cle, t.emergence])) as Record<TierScore, number>;

/** Expression MapLibre `match` : tier → facteur de proéminence (défaut = valeur d'un B, tier inconnu = discret mais visible). */
export const exprProminence = (): unknown => [
  'match',
  ['get', 'tier'],
  ...TIERS_SCORE.flatMap((t) => [t.cle, t.prominence]),
  0.64,
];

/** Expression MapLibre `match` : tier → zoom d'émergence (défaut = émergence d'un B). */
export const exprEmergence = (): unknown => [
  'match',
  ['get', 'tier'],
  ...TIERS_SCORE.flatMap((t) => [t.cle, t.emergence]),
  8.2,
];

export const prominenceDe = (t: string | null | undefined): number => PROMINENCE[(t ?? '') as TierScore] ?? 0.64;
export const emergenceDe = (t: string | null | undefined): number => EMERGENCE[(t ?? '') as TierScore] ?? 8.2;

// Simulation DEV UNIQUEMENT (R1) : d'ici le recompute d'A (dump à 5 tiers), l'échantillon stagé n'a que 4 crans
// (T/S/A/B). Pour donner à voir les 5 crans, on dérive un tier simulé déterministe par `poi_id` : une part des B
// devient C (les « secondaires »), et quelques A deviennent B, pour approcher la distribution cible. JAMAIS en prod :
// au flip, le champ `tier` du dump porte déjà T/S/A/B/C et cette simulation est retirée.
export function tierSimule5(tierReel: string | null | undefined, poiId: string | number): TierScore {
  const t = (tierReel ?? 'C') as TierScore;
  let h = 0;
  const s = String(poiId);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const r = h % 100;
  // ~55 % des B deviennent C ; ~25 % des A deviennent B → gonfle le bas de la distribution (cible C223 > B196 > A188).
  if (t === 'B') return r < 55 ? 'C' : 'B';
  if (t === 'A') return r < 25 ? 'B' : 'A';
  return t;
}

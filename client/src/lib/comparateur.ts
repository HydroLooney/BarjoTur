import type { BudgetComparatif } from '@barjotur/shared';

// Comparateur (C-20 / A12) : lire côte à côte les profils d'itinéraire comparés (consensus, membres,
// archétypes) et rendre LISIBLE le consensus égalitariste, c'est à dire « ce que chacun gagne ou cède »
// par rapport à la décision commune. Honnêteté R1 : on ne fabrique rien. On lit l'écart MESURÉ entre
// l'itinéraire préféré de chacun et le consensus retenu (km, nuits, budget), rien de plus. La lecture
// égalitariste consiste à rendre visible qui s'éloigne le plus du choix partagé (celui qui cède le plus).

export type NatureProfil = 'consensus' | 'membre' | 'archetype';

export interface ProfilCompare {
  ligne: BudgetComparatif;
  nature: NatureProfil;
  nom: string;
}

export interface EcartConsensus {
  dKm: number;
  dNuits: number;
  dBudget: number;
}

/** Nature d'un profil : consensus, itinéraire d'un membre, ou archétype de voyage. */
export function natureDe(l: BudgetComparatif): NatureProfil {
  if (l.source === 'consensus') return 'consensus';
  if (l.archetype_key != null) return 'archetype';
  if (l.prenom != null) return 'membre';
  return 'consensus';
}

/** Nom lisible d'un profil (prénom du membre, libellé, clé d'archétype, ou « Consensus »). */
export function nomProfil(l: BudgetComparatif): string {
  if (l.prenom) return l.prenom;
  if (l.label) return l.label;
  if (l.archetype_key) return l.archetype_key;
  if (l.source === 'consensus') return 'Consensus';
  return l.source || 'Profil';
}

/** Répartit les lignes de budget comparatif en consensus / membres / archétypes. */
export function classerProfils(lignes: BudgetComparatif[]): {
  consensus: ProfilCompare | null;
  membres: ProfilCompare[];
  archetypes: ProfilCompare[];
} {
  const profils: ProfilCompare[] = lignes.map((ligne) => ({
    ligne,
    nature: natureDe(ligne),
    nom: nomProfil(ligne),
  }));
  return {
    consensus: profils.find((p) => p.nature === 'consensus') ?? null,
    membres: profils.filter((p) => p.nature === 'membre'),
    archetypes: profils.filter((p) => p.nature === 'archetype'),
  };
}

/** Écart mesuré d'un profil au consensus (positif = plus que le consensus). */
export function ecartAuConsensus(l: BudgetComparatif, consensus: BudgetComparatif): EcartConsensus {
  return {
    dKm: l.km - consensus.km,
    dNuits: l.nuits - consensus.nuits,
    dBudget: l.total_prudent_eur - consensus.total_prudent_eur,
  };
}

/**
 * Amplitude de lecture d'un écart : heuristique pour repérer qui s'éloigne le plus du consensus (A12,
 * celui qui cède le plus). On additionne les écarts absolus ramenés à des ordres de grandeur simples
 * (1 nuit ≈ 1, 100 km ≈ 1, 100 € ≈ 1). Aide à la lecture, pas une mesure de bien-être.
 */
export function amplitudeEcart(e: EcartConsensus): number {
  return Math.abs(e.dNuits) + Math.abs(e.dKm) / 100 + Math.abs(e.dBudget) / 100;
}

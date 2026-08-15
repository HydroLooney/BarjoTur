// Optimisation PURE des legs de transit (M315 item 3, G3) : repositionnement depart→arrivee de coût minimal, honorant
// les arrêts IMPOSÉS (réservations, jalons obligatoires) dans le meilleur ordre. Le coût réel par leg (temps/€) vient du
// corridor d'A (`variante_transit`, gaté) et est INJECTÉ ici (fonction `cout`) : ce module ne route pas, il ORDONNE.
// Exact par énumération des permutations des imposés (leur nombre est petit : quelques réservations par étape). Un leg
// non routable rend +Infinity → la permutation est écartée ; si aucune n'est réalisable, `faisable=false`. Pur, sans DB.
//
// Se branchera dans `services/transit.ts::optimiserTransit` (qui lève aujourd'hui, gaté corridor) quand A livre les
// coûts : optimiserTransit fournira `cout` depuis le corridor et appellera optimiserSequenceTransit.

export interface ResultatTransit {
  /** Séquence ordonnée depart → …imposés… → arrivee. */
  arrets: string[];
  /** Coût cumulé (unité du modèle injecté : temps ou €). +Infinity si infaisable. */
  cout_total: number;
  /** Faux si aucune permutation des imposés n'est routable (un leg manquant partout). */
  faisable: boolean;
}

/** Toutes les permutations d'un tableau (Heap-like simple, récursif). Pur. Réservé aux petits ensembles. */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i++) {
    const reste = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(reste)) out.push([xs[i]!, ...p]);
  }
  return out;
}

/** Coût d'un chemin ordonné = somme des legs consécutifs (s'arrête à +Infinity dès un leg non routable). Pur. */
function coutChemin(chemin: readonly string[], cout: (de: string, vers: string) => number): number {
  let total = 0;
  for (let i = 0; i + 1 < chemin.length; i++) {
    const c = cout(chemin[i]!, chemin[i + 1]!);
    if (!Number.isFinite(c)) return Number.POSITIVE_INFINITY;
    total += c;
  }
  return total;
}

/**
 * Ordonne un leg de transit depart→arrivee en passant par tous les arrêts imposés, au coût minimal. `cout(de,vers)`
 * rend le coût d'un leg (+Infinity si non routable). Rend la séquence retenue, son coût, et `faisable`. Sans imposé =
 * leg direct. Précondition : depart et arrivee non vides. Pur.
 */
export function optimiserSequenceTransit(
  depart: string,
  arrivee: string,
  imposes: readonly string[],
  cout: (de: string, vers: string) => number,
): ResultatTransit {
  let meilleur: string[] | null = null;
  let meilleurCout = Number.POSITIVE_INFINITY;
  for (const perm of permutations(imposes)) {
    const chemin = [depart, ...perm, arrivee];
    const c = coutChemin(chemin, cout);
    if (c < meilleurCout) {
      meilleurCout = c;
      meilleur = chemin;
    }
  }
  if (meilleur === null || !Number.isFinite(meilleurCout)) {
    return { arrets: [depart, ...imposes, arrivee], cout_total: Number.POSITIVE_INFINITY, faisable: false };
  }
  return { arrets: meilleur, cout_total: meilleurCout, faisable: true };
}

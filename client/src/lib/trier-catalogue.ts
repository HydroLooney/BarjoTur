import type { CataloguePoi } from '@barjotur/shared';

// Tri de la liste Explorer (M181 §B5). Par defaut « recommandes » : on met en tete ce qui vaut le voyage,
// pour que la personne commence par le meilleur au lieu de subir 700 lignes a plat. Honnetete R1 : le score
// reel (A) prime quand il existe ; sinon on retombe sur le rang d'avis par defaut (T>S>A>B), jamais un ordre
// invente. Le mode « nom » reste offert pour retrouver un lieu precis. Aucun jargon a l'ecran (R7).

export type TriCatalogue = 'recommandes' | 'nom';

export const TRIS: { cle: TriCatalogue; libelle: string }[] = [
  { cle: 'recommandes', libelle: 'Recommandés' },
  { cle: 'nom', libelle: 'A → Z' },
];

// Rang d'avis par defaut, du plus fort au plus faible. Sert de repli quand le score chiffre manque.
const RANG_AVIS: Record<string, number> = { T: 0, S: 1, A: 2, B: 3 };

function rangAvis(p: CataloguePoi): number {
  const t = p.tier_defaut;
  return t && t in RANG_AVIS ? RANG_AVIS[t]! : 9;
}

/** Trie une COPIE de la liste selon le mode. « recommandes » = score desc (defauts en dernier), puis avis, puis nom. */
export function trierCatalogue(pois: CataloguePoi[], mode: TriCatalogue): CataloguePoi[] {
  const copie = [...pois];
  if (mode === 'nom') {
    return copie.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  return copie.sort((a, b) => {
    const sa = typeof a.score_mcda === 'number' ? a.score_mcda : -1;
    const sb = typeof b.score_mcda === 'number' ? b.score_mcda : -1;
    if (sb !== sa) return sb - sa;
    const ra = rangAvis(a);
    const rb = rangAvis(b);
    if (ra !== rb) return ra - rb;
    return a.nom.localeCompare(b.nom, 'fr');
  });
}

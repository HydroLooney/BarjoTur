import type { CataloguePoi } from '@barjotur/shared';

export interface FiltresCatalogue {
  recherche: string;
  categorie: string | null;
  /** Compare a tier_defaut (chaine : T/S/A/B, voire au-dela). */
  tier: string | null;
  votableSeul: boolean;
}

/** Normalise pour comparaison : sans accents, minuscule, trim. */
export function normaliserTexte(s: string): string {
  // Retire les diacritiques (combinaison Unicode U+0300..U+036F), plage echappee (pas de char litteral).
  const diacritiques = new RegExp('[\\u0300-\\u036f]', 'g');
  return s.normalize('NFD').replace(diacritiques, '').toLowerCase().trim();
}

// Filtre le catalogue selon les facettes. Exclut TOUJOURS les POI marques `exclu` (filtre editorial DB).
// La recherche porte sur le nom (insensible aux accents et a la casse).
export function filtrerCatalogue(pois: CataloguePoi[], f: FiltresCatalogue): CataloguePoi[] {
  const q = normaliserTexte(f.recherche);
  return pois.filter((p) => {
    if (p.exclu === true) return false;
    if (f.votableSeul && !p.votable) return false;
    if (f.categorie && p.categorie !== f.categorie) return false;
    if (f.tier && p.tier_defaut !== f.tier) return false;
    if (q && !normaliserTexte(p.nom).includes(q)) return false;
    return true;
  });
}

/** Liste triee (fr) des categories presentes dans le catalogue, pour le selecteur de facette. */
export function categoriesDisponibles(pois: CataloguePoi[]): string[] {
  const set = new Set<string>();
  for (const p of pois) if (p.categorie) set.add(p.categorie);
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

import type { CataloguePoi } from '@barjotur/shared';
import { bucketDepuisSource, CATEGORIES, type CategoriePoi } from '@/lib/categories-poi';

export interface FiltresCatalogue {
  recherche: string;
  /** BUCKET (cle des 18 catégories), aligné sur la carte/légende/panneau (étape 3-5). */
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
    if (f.categorie && bucketDepuisSource(p.categorie).cle !== f.categorie) return false;
    if (f.tier && p.tier_defaut !== f.tier) return false;
    if (q && !normaliserTexte(p.nom).includes(q)) return false;
    return true;
  });
}

/** Les BUCKETS (catégories des 18) présents dans le catalogue, dans l'ordre du contrat — pour le sélecteur de facette. */
export function bucketsDisponibles(pois: CataloguePoi[]): CategoriePoi[] {
  const presents = new Set<string>();
  for (const p of pois) presents.add(bucketDepuisSource(p.categorie).cle);
  return CATEGORIES.filter((c) => presents.has(c.cle));
}

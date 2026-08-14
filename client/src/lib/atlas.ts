import type { EtapeFige, ResumeJour } from '@barjotur/shared';

// Atlas (M103) : le voyage sur papier, une page par jour. Le contenu riche d'un jour (camp de base, lieux + temps
// sur place, trajet, ferry, budget du jour) vit dans `fige.etape.resume_jour`, désormais typé `ResumeJour | null`
// au contrat partagé (M105). Hors live, la fixture le remplit ; au flip, B le produit à cette forme. Le rendu ne
// montre que ce qui est présent (dégradé propre, R1).

/** Lit le résumé d'un jour depuis l'étape, avec un repli vide sûr (aucun champ requis). */
export function resumeDe(etape: EtapeFige): ResumeJour {
  return etape.resume_jour ?? {};
}

/** Nom du camp de base du jour : le résumé s'il le porte, sinon un repli lisible depuis l'identifiant. */
export function campDeBase(etape: EtapeFige): string | null {
  const nom = resumeDe(etape).camp_base;
  if (nom) return nom;
  return etape.base_id != null ? `Camp de base nº ${etape.base_id}` : null;
}

/** La nuit se dit en clair : autonomie (aire, bivouac) ou hébergement payant, selon `nuitee_type`. */
export function libelleNuit(nuiteeType: string | null): string | null {
  if (!nuiteeType) return null;
  const t = nuiteeType.toLowerCase();
  if (t.includes('autonom') || t.includes('aire') || t.includes('bivouac')) return 'Nuit en autonomie';
  if (t.includes('pay') || t.includes('camping') || t.includes('hebe') || t.includes('hôtel')) return 'Nuit payante';
  return nuiteeType;
}

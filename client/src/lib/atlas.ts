import type { EtapeFige } from '@barjotur/shared';

// Atlas (M103) : le voyage sur papier, une page par jour. Le contenu riche d'un jour (camp de base, lieux + temps
// sur place, trajet, ferry, budget du jour) vit dans `fige.etape.resume_jour`, un jsonb libre côté contrat. On en
// donne ici une INTERPRÉTATION front, à confirmer au flip (B fournit le jsonb réel). Hors live, la fixture le
// remplit ; le rendu ne montre que ce qui est présent (dégradé propre, R1). Km/ferry/budget viennent aussi de la
// compo/budget-jour de B au flip ; d'ici là ce sont des valeurs illustratives.

/** Un lieu visité dans la journée, avec le temps qu'on y passe. */
export interface LieuJour {
  nom: string;
  temps_min: number;
}

/** Forme SUPPOSÉE du jsonb `resume_jour` (à confirmer au flip). Tout est optionnel : on rend ce qui existe. */
export interface ResumeJour {
  camp_base?: string;
  km?: number;
  ferry_min?: number;
  ferry_eur?: number;
  traversees?: number;
  budget_eur?: number;
  lieux?: LieuJour[];
}

/** Lit le résumé d'un jour depuis l'étape (jsonb non typé au contrat), avec un repli vide sûr. */
export function resumeDe(etape: EtapeFige): ResumeJour {
  const r = etape.resume_jour;
  return r && typeof r === 'object' ? (r as ResumeJour) : {};
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

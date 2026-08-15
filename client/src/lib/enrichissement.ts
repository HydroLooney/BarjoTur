import type { PoiEnrichissement, SignalCommunaute } from '@barjotur/shared';

// Provenance d'un lieu (A28 / M137) : d'où vient sa réputation. Trois signaux, dits en clair (glossaire :
// « réputation », « ce qu'il s'en dit »). La CONCORDANCE fait la robustesse : un lieu que plusieurs communautés
// indépendantes recommandent est un signal fort. Pur et testable ; au flip, la vraie donnée vient d'A.

/** Libellé clair d'une aire linguistique. */
const AIRE_LABEL: Record<string, string> = {
  scandinave: 'scandinave',
  nl_de: 'néerlandaise et allemande',
  fr_be: 'francophone',
  anglophone: 'anglophone',
  russophone: 'russophone',
};

export function libelleAire(aire: string): string {
  return AIRE_LABEL[aire] ?? aire;
}

/** L'origine « guide papier » d'un lieu, si un guide l'endosse (sa source, ex. « Guide Coup de Cœur, p. 12 »). */
export function origineGuide(enr: PoiEnrichissement | null | undefined): string | null {
  return enr?.provenance?.find((p) => p.canal === 'guide_papier')?.source ?? null;
}

/** Nombre de communautés INDÉPENDANTES qui citent le lieu (aires avec au moins une source). La vraie robustesse. */
export function nbCommunautes(signaux: SignalCommunaute[] | null | undefined): number {
  return (signaux ?? []).filter((s) => s.n_sources > 0).length;
}

/** Nombre total de citations, toutes communautés confondues. */
export function totalCitations(signaux: SignalCommunaute[] | null | undefined): number {
  return (signaux ?? []).reduce((acc, s) => acc + s.n_sources, 0);
}

/** Le lieu est-il une « perle » (peu connu mais fortement endossé) dans au moins une aire ? */
export function estPerle(signaux: SignalCommunaute[] | null | undefined): boolean {
  return (signaux ?? []).some((s) => s.perle);
}

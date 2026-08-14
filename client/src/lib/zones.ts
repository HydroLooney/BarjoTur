import type { ZoneActiviteIdeale } from '@barjotur/shared';

// Activité idéale par zone (M108) : libellés de thème au clair et rapprochement avec les envies par thème du
// voyageur. Un voyageur qui pousse le nautique voit remonter les zones où le guide conseille le kayak. Pur et
// testable ; les appétits viennent du store budget-temps (réglés à l'écran « Vos envies par thème »).

/** Libellé lisible d'un thème d'activité (repli sur la valeur brute si inconnue). */
const THEME_LABEL: Record<string, string> = {
  nautique: 'nautique',
  faune: 'faune et animaux',
  patrimoine: 'patrimoine',
  baignade: 'baignade',
  panorama: 'panoramas',
  rando: 'rando',
};

export function libelleTheme(theme: string): string {
  return THEME_LABEL[theme] ?? theme;
}

/** Appétit du voyageur pour le thème d'une zone (0 si non réglé). */
export function enviePourZone(z: ZoneActiviteIdeale, appetits: Record<string, number>): number {
  return appetits[z.theme] ?? 0;
}

/**
 * Trie les zones en mettant d'abord celles qui collent aux envies fortes du voyageur (appétit décroissant) ;
 * à égalité, l'ordre d'entrée est préservé (tri stable).
 */
export function trierZonesParEnvie(
  zones: ZoneActiviteIdeale[],
  appetits: Record<string, number>,
): ZoneActiviteIdeale[] {
  return zones
    .map((z, i) => ({ z, i }))
    .sort((a, b) => {
      const d = enviePourZone(b.z, appetits) - enviePourZone(a.z, appetits);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.z);
}

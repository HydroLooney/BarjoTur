import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { AVIS, RECOMMANDATIONS } from '@/lib/libelles';

// Rails de recommandation de l'Explorer (A20 §11 / M057). Recommander, pas lister à plat : des rails curés
// au-dessus du parcours libre. Honnêteté R1 : chaque item dit POURQUOI il est là (qualité ? votre vote ?
// la famille ?). Source réelle = score_mcda / reward (A) au flip ; d'ici là, repli honnête par tier par
// défaut, explicitement étiqueté. Le rail « Sur votre route » (proximité itinéraire) vit dans la vue (géom).

export interface ItemRecommande {
  poi: CataloguePoi;
  pourquoi: string;
}
export interface Rail {
  cle: string;
  titre: string;
  description: string;
  items: ItemRecommande[];
}

const MAX = 10;

function estPepite(p: CataloguePoi): boolean {
  return p.flag_pepite === true; // champ annexe (index signature), vrai si le flag est posé
}

/** Les incontournables : score MCDA élevé (A) si présent, sinon repli par tier majeur (T/S) par défaut. */
export function railIncontournables(pois: CataloguePoi[]): ItemRecommande[] {
  const avecScore = pois.filter((p) => typeof p.score_mcda === 'number');
  if (avecScore.length > 0) {
    return [...avecScore]
      .sort((a, b) => (b.score_mcda ?? 0) - (a.score_mcda ?? 0))
      .slice(0, MAX)
      .map((poi) => ({ poi, pourquoi: `Qualité élevée (score ${Math.round((poi.score_mcda ?? 0) * 100)}/100).` }));
  }
  return pois
    .filter((p) => p.tier_defaut === 'T' || p.tier_defaut === 'S')
    .slice(0, MAX)
    .map((poi) => ({ poi, pourquoi: 'Un incontournable de la région.' }));
}

/** La famille adore : les valeurs sûres (repli sur le défaut « famille », en attendant le consensus des votes). */
export function railFamille(pois: CataloguePoi[]): ItemRecommande[] {
  return pois
    .filter((p) => p.tier_defaut === 'A')
    .slice(0, MAX)
    .map((poi) => ({ poi, pourquoi: 'Une valeur sûre pour toute la famille.' }));
}

/** Pépites : les trouvailles signalées (flag pépite). */
export function railPepites(pois: CataloguePoi[]): ItemRecommande[] {
  return pois.filter(estPepite).slice(0, MAX).map((poi) => ({ poi, pourquoi: 'Pépite signalée.' }));
}

/** Pour chacun : à partir de VOS votes (esprit + envies + V_poi affineront au flip). */
export function railPourChacun(pois: CataloguePoi[], mesTiers: Record<string, VoteTier>): ItemRecommande[] {
  return pois
    .filter((p) => {
      const t = mesTiers[`p:${p.id}`];
      return t === 'T' || t === 'S' || t === 'A';
    })
    .slice(0, MAX)
    .map((poi) => {
      const t = mesTiers[`p:${poi.id}`] as keyof typeof AVIS;
      return { poi, pourquoi: `Vous avez dit « ${AVIS[t] ?? 'votre avis'} ».` };
    });
}

/** Construit les rails non vides, dans l'ordre d'affichage. */
export function construireRails(pois: CataloguePoi[], mesTiers: Record<string, VoteTier>): Rail[] {
  const defs: Rail[] = [
    { cle: 'incontournables', titre: RECOMMANDATIONS.incontournables, description: 'Les repères à ne pas manquer.', items: railIncontournables(pois) },
    { cle: 'pour-chacun', titre: RECOMMANDATIONS.pourChacun, description: 'À partir de vos votes.', items: railPourChacun(pois, mesTiers) },
    { cle: 'famille', titre: RECOMMANDATIONS.famille, description: 'Les valeurs sûres pour tous.', items: railFamille(pois) },
    { cle: 'pepites', titre: RECOMMANDATIONS.pepites, description: 'Les trouvailles hors des sentiers battus.', items: railPepites(pois) },
  ];
  return defs.filter((r) => r.items.length > 0);
}

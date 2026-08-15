// Système de fond de carte (DOCTRINE-CARTO §2 : « beau par la sobriété, fond MULTI-ÉCHELLE, PERSONNALISÉ »).
//
// Principe clé : sous MapLibre, le STYLE (JSON : couleurs des couches, étiquettes) est INDÉPENDANT des tuiles.
// On consomme le flux hébergé VersaTiles (libre, OSM, sans clé) et, pour le fond par défaut, on PATCHE le style
// graybeard aux couleurs de la charte — personnalisation immédiate, zéro octet à héberger (le « style perso » de M).
// Le topo raster (relief/sentiers au zoom rapproché) reste une couche à part (cf CoucheTopo), pas un style.
//
// Zéro hex ici : les couleurs viennent des jetons de charte via `charte()` (ui/theme). Le patch relit les jetons
// au changement de thème, donc le fond suit le mode sombre comme le reste de l'app.

import type { StyleSpecification, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { charte } from '@/ui/theme';

export type CleFond = 'graybeard' | 'neutrino' | 'colorful' | 'topo';

interface OptionFond {
  cle: CleFond;
  /** Libellé côté utilisateur (voix charte, pas le nom technique du style). */
  libelle: string;
  /** Une ligne d'aide (title/tooltip). */
  aide: string;
}

// Le sélecteur parle la langue de l'utilisateur (« Doux / Épuré / Coloré / Relief »), pas « graybeard/neutrino ».
export const FONDS: OptionFond[] = [
  { cle: 'graybeard', libelle: 'Doux', aide: 'Fond apaisé aux couleurs du carnet (défaut)' },
  { cle: 'neutrino', libelle: 'Épuré', aide: 'Fond minimal, encore plus discret' },
  { cle: 'colorful', libelle: 'Coloré', aide: 'Fond plus vif, relief marqué' },
  { cle: 'topo', libelle: 'Relief', aide: 'Fond topographique (sentiers, courbes de niveau)' },
];

const BASE = 'https://tiles.versatiles.org/assets/styles';
export const URL_GRAYBEARD = `${BASE}/graybeard/style.json`;
export const URL_NEUTRINO = `${BASE}/neutrino/style.json`;
export const URL_COLORFUL = `${BASE}/colorful/style.json`;

// Détecte le rôle d'une couche du style hébergé par des motifs d'id robustes (les styles VersaTiles nomment
// water/ocean, wood/forest/park/grass, highway/road/street, etc.). On ne recolore que ces rôles, on laisse le
// reste tel quel. Si une valeur de peinture est une expression data-driven, on la remplace par une constante de
// charte (acceptable : le fond doit être calme et uni, pas expressif).
function role(id: string): 'eau' | 'couvert' | 'route' | null {
  const s = id.toLowerCase();
  if (/(water|ocean|sea|river|lake|fjord|bay|reservoir)/.test(s)) return 'eau';
  if (/(wood|forest|park|grass|green|nature|meadow|scrub|heath|wetland|glacier|ice|landcover)/.test(s)) return 'couvert';
  if (/(highway|road|street|transport|bridge|tunnel|rail|path|track|aeroway|runway|taxiway)/.test(s)) return 'route';
  return null;
}

function poser(couche: LayerSpecification, prop: string, valeur: string): void {
  // On n'écrase que si la propriété existe déjà (la couche sait peindre cette chose) OU pour background/symbol.
  const paint = ((couche as { paint?: Record<string, unknown> }).paint ??= {});
  paint[prop] = valeur;
}

// Patch en place : recolore background, eau, couvert, routes et étiquettes aux jetons de charte.
function patcherCharte(style: StyleSpecification): void {
  const terre = charte('--carte-terre');
  const eau = charte('--carte-eau');
  const couvert = charte('--carte-couvert');
  const route = charte('--carte-route');
  const etiquette = charte('--carte-etiquette');
  const halo = charte('--carte-etiquette-halo');

  for (const couche of style.layers ?? []) {
    try {
      const id = couche.id ?? '';
      if (couche.type === 'background') {
        poser(couche, 'background-color', terre);
        continue;
      }
      if (couche.type === 'symbol') {
        const p = (couche as { paint?: Record<string, unknown> }).paint;
        // On ne touche au texte que si la couche porte du texte (évite les couches d'icônes pures).
        if (p && 'text-color' in p) {
          poser(couche, 'text-color', etiquette);
          poser(couche, 'text-halo-color', halo);
        }
        continue;
      }
      const r = role(id);
      if (couche.type === 'fill') {
        if (r === 'eau') poser(couche, 'fill-color', eau);
        else if (r === 'couvert') poser(couche, 'fill-color', couvert);
        else poser(couche, 'fill-color', terre); // reste du couvert terrestre = fond uni chaud
      } else if (couche.type === 'line') {
        if (r === 'eau') poser(couche, 'line-color', eau);
        else if (r === 'route') poser(couche, 'line-color', route);
        else poser(couche, 'line-color', route);
      }
    } catch {
      // Une couche exotique ne doit jamais casser le fond : on la laisse telle quelle.
    }
  }
}

// Charge le style graybeard hébergé et le patche aux couleurs de la charte du thème courant. Mémoïsé par thème
// (le patch relit les jetons, donc un cache par thème suffit ; le clair et le sombre coexistent).
const cache = new Map<string, StyleSpecification>();

export async function styleCharte(theme: string): Promise<StyleSpecification> {
  const enCache = cache.get(theme);
  if (enCache) return enCache;
  const rep = await fetch(URL_GRAYBEARD);
  if (!rep.ok) throw new Error(`Style graybeard indisponible (${rep.status})`);
  const style = (await rep.json()) as StyleSpecification;
  patcherCharte(style);
  cache.set(theme, style);
  return style;
}

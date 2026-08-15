// Math d'animation de la carte itineraire, PORTEE du prototype norvege-2027 (Voyager.jsx,
// commit 7d100d6 / C093 : « anim STRICTE sur fige.geom, zero repli ordre_bases »). C'est la
// brique qui a tue le bug des lignes droites : on ne reconstruit plus le trace leg-par-leg,
// on consomme la geometrie CONTINUE du fige DANS L'ORDRE LIVRE par B.
//
// Fonctions PURES, sans React ni MapLibre : testables (voir anim-trajet.test.ts). Le composant
// carto (CarteItineraire) les consomme et dessine ; la verite du rendu vit ici.
//
// Convention de coordonnees :
//   - GeoJSON = [lon, lat] (type Pos ci-dessous), c'est ce que livre B dans fige.geom.
//   - Interne = [lat, lng] (type LL), repris tel quel du prototype pour la projection.
// toLL fait la bascule ; le composant refait l'inverse pour MapLibre.

import type { Feature, Geometry, LineString, Position } from 'geojson';

/** Position GeoJSON, ordre [longitude, latitude]. */
export type Pos = [number, number];

/** Point interne pour le calcul, ordre [latitude, longitude] (repris du prototype). */
export type LL = [number, number];

/** Nature d'un point du trace : 'boucle' = route terrestre continue, 'liaison' = traversee d'eau (tiretee). */
export type Nature = 'boucle' | 'liaison';

/** Phase du voyage : 'aller' (départ → apex) vs 'retour' (apex → départ). Apex = point le plus loin du départ. */
export type Phase = 'aller' | 'retour';

/** Une etape (nuitee) fournie par l'agenda, avec sa coordonnee resolue en [lon, lat] (ou null si non calee). */
export interface EtapeEntree {
  ordre: number;
  nom?: string;
  nuits?: number;
  date?: string | null;
  type?: string;
  /** Coordonnee [lon, lat] de l'etape, ou null : on la projette alors sur le point le plus proche du trace. */
  coord: Pos | null;
}

/** Une etape projetee sur le trace anime. */
export interface EtapeAnim {
  ll: LL;
  ordre: number;
  nom: string;
  nuits: number;
  date: string | null;
  type: string | undefined;
  /** Temps cumule (dans [0, total]) au point du trace le plus proche de l'etape. */
  time: number;
  /** Position normalisee dans [0, 1]. */
  pos: number;
}

export interface Leg {
  a: number;
  b: number;
  libelle: string;
  kind: 'boucle';
  scenique: boolean;
}

/** Modele d'animation : le trace (pts), le temps cumule (cum), la nature par point, les etapes projetees. */
export interface ModeleAnim {
  pts: LL[];
  cum: number[];
  /** Convention d'index : nature[i] qualifie l'ARC entrant au point i (segment pts[i-1] -> pts[i]). nature[0] = 'boucle' (le premier point n'a pas d'arc entrant). */
  nature: Nature[];
  /** Phase par point : 'aller' jusqu'à l'apex (le plus loin du départ), 'retour' ensuite. Support unique des couleurs aller/retour (tracé/barre/agenda/carnet). */
  phase: Phase[];
  /** Temps cumulé (dans [0, total]) à l'apex : bascule aller → retour. */
  tApex: number;
  legs: Leg[];
  etapes: EtapeAnim[];
  /** Temps total (echelle des cum). Vaut 1 si trace vide, pour eviter les divisions par zero. */
  total: number;
  /** true si le trace est un repli schematique (a vol d'oiseau) faute de fige.geom (R1). Ici toujours false. */
  schematique: boolean;
}

// Seuil de TRAVERSEE (M235/B085) : une jonction entre deux troncons routes plus grande que ~0,9 km
// = franchissement d'eau (ferry/ile, gap admis par la geometrie continue) -> rendue 'liaison' (TIRETE),
// jamais un trait plein droit « bug ». Detection GEOMETRIQUE, robuste au format de fige.geom.
const SEUIL_TRAVERSEE = 0.008; // ~0,9 km en degres

// Facteur degres -> km (approx. equirectangulaire), pour exprimer les distances en km (preuve du gate).
const DEG_EN_KM = 111.32;

/** Distance equirectangulaire approchee entre deux points [lat, lng], en degres. */
export function dist(a: LL, b: LL): number {
  const dy = a[0] - b[0];
  const dx = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dy * dy + dx * dx);
}

/** Distance approchee entre deux points [lat, lng], en kilometres. */
export function distKm(a: LL, b: LL): number {
  return dist(a, b) * DEG_EN_KM;
}

/** GeoJSON [lon, lat] -> interne [lat, lng]. */
export function toLL(coords: Position[]): LL[] {
  return coords.map((c) => [c[1] as number, c[0] as number] as LL);
}

/**
 * Extrait les suites de coordonnees d'une geometrie fige.geom, DANS L'ORDRE LIVRE.
 * Accepte LineString, MultiLineString, GeometryCollection (de LineString) et Feature.
 * Le socle shared type encore geom en LineString ; on gere ici les cas reels (MultiLineString...)
 * en attendant l'elargissement additif de shared (demande C001).
 */
function extraireSegments(geom: Geometry | Feature | null | undefined): Position[][] {
  if (!geom) return [];
  if (geom.type === 'Feature') return extraireSegments(geom.geometry);
  if (geom.type === 'MultiLineString') return geom.coordinates;
  if (geom.type === 'GeometryCollection') {
    return geom.geometries
      .filter((g): g is LineString => !!g && g.type === 'LineString' && Array.isArray(g.coordinates))
      .map((g) => g.coordinates);
  }
  if (geom.type === 'LineString') return [geom.coordinates];
  return [];
}

/**
 * Construit le modele d'animation depuis la geometrie CONTINUE du fige.
 *
 * On concatene les LineString DANS L'ORDRE LIVRE (pas de reorientation : la fige.geom de B est deja
 * ordonnee dans le sens du voyage ; la reorienter cassait l'ordre de parcours, cf M238). On projette
 * le temps au prorata de la longueur, et on marque 'liaison' (tiretee) toute jonction plus grande que
 * le seuil de traversee. Les etapes (nuitees) sont projetees sur le point le plus proche.
 *
 * @param geom fige.geom (LineString / MultiLineString / GeometryCollection / Feature).
 * @param etapesSrc etapes de l'agenda avec coordonnee resolue (facultatif).
 */
export function modeleAnimationFigeGeom(
  geom: Geometry | Feature | null | undefined,
  etapesSrc: EtapeEntree[] = [],
): ModeleAnim {
  const vide: ModeleAnim = { pts: [], cum: [], nature: [], phase: [], tApex: 0, legs: [], etapes: [], total: 1, schematique: false };

  const segs = extraireSegments(geom);
  const runs = segs
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map((c) => ({ ll: toLL(c), nat: 'boucle' as Nature }))
    .filter((r) => r.ll.length >= 2);
  if (!runs.length) return vide;

  // Longueur totale (somme des troncons continus), pour normaliser le temps.
  let slen = 0;
  for (const r of runs) {
    for (let i = 1; i < r.ll.length; i++) {
      const p0 = r.ll[i - 1];
      const p1 = r.ll[i];
      if (p0 && p1) slen += dist(p0, p1);
    }
  }

  const pts: LL[] = [];
  const cum: number[] = [];
  const nature: Nature[] = [];
  let t = 0;

  for (const r of runs) {
    for (let i = 0; i < r.ll.length; i++) {
      const pt = r.ll[i];
      if (!pt) continue;
      if (i === 0) {
        if (!pts.length) {
          pts.push(pt);
          cum.push(t);
          nature.push(r.nat);
          continue;
        }
        const last = pts[pts.length - 1];
        // Jonction continue (meme point) : on ne duplique pas.
        if (last && last[0] === pt[0] && last[1] === pt[1]) continue;
        const saut = last ? dist(last, pt) : 0;
        t += saut / (slen || 1);
        pts.push(pt);
        cum.push(t);
        nature.push(saut > SEUIL_TRAVERSEE ? 'liaison' : r.nat);
        continue;
      }
      const prev = r.ll[i - 1];
      t += (prev ? dist(prev, pt) : 0) / (slen || 1);
      pts.push(pt);
      cum.push(t);
      nature.push(r.nat);
    }
  }

  if (pts.length < 2) return vide;
  const total = cum[cum.length - 1] || 1;

  // Projection des etapes sur le point le plus proche (on garde `best` pour le dwell du rythme).
  const projete = etapesSrc.map((e, i) => {
    const coord = e.coord;
    let best = 0;
    let bd = Infinity;
    if (coord) {
      const cible: LL = [coord[1], coord[0]];
      for (let k = 0; k < pts.length; k++) {
        const pk = pts[k];
        if (!pk) continue;
        const d = dist(pk, cible);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
    }
    return { e, i, best, nuits: Number(e.nuits) || 1 };
  });

  // RYTHME ∝ TEMPS (M307 sous-brique 4) : on ajoute un DWELL au temps cumule a chaque etape, proportionnel aux
  // NUITS (une base par etape + un supplement par nuit). Le curseur RALENTIT en approchant d'un camp, et d'autant
  // plus qu'on y reste plusieurs nuits — le rythme raconte l'allocation reelle du temps, pas une vitesse constante.
  const DWELL_BASE = total * 0.05;
  const DWELL_NUIT = total * 0.08;
  const dwellAt = new Array<number>(pts.length).fill(0);
  for (const p of projete) dwellAt[p.best] = (dwellAt[p.best] ?? 0) + DWELL_BASE + p.nuits * DWELL_NUIT;
  const cumD: number[] = [];
  let acc = 0;
  for (let k = 0; k < pts.length; k++) {
    acc += dwellAt[k] ?? 0;
    cumD.push((cum[k] ?? 0) + acc);
  }
  const totalD = cumD[cumD.length - 1] || 1;

  // Etapes finales, temps recalcule APRES dwell (l'agenda pilote la vitesse locale).
  const etapes: EtapeAnim[] = projete
    .map(({ e, i, best }) => {
      const coord = e.coord;
      const ancre = pts[best];
      const tb = cumD[best] ?? 0;
      return {
        ll: coord ? ([coord[1], coord[0]] as LL) : (ancre ?? [0, 0]),
        ordre: e.ordre ?? i + 1,
        nom: e.nom ?? `Étape ${i + 1}`,
        nuits: Number(e.nuits) || 1,
        date: e.date ?? null,
        type: e.type,
        time: tb,
        pos: tb / totalD,
      } satisfies EtapeAnim;
    })
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  // Phase aller/retour : l'APEX = le point le plus loin (géographiquement) du départ (inchange par le dwell).
  const depart = pts[0] as LL;
  let apex = 0;
  let dMax = -1;
  for (let k = 0; k < pts.length; k++) {
    const pk = pts[k];
    if (!pk) continue;
    const d = dist(pk, depart);
    if (d > dMax) {
      dMax = d;
      apex = k;
    }
  }
  const phase: Phase[] = pts.map((_, k) => (k <= apex ? 'aller' : 'retour'));
  const tApex = cumD[apex] ?? totalD;

  const legs: Leg[] = [{ a: 0, b: totalD, libelle: 'Itinéraire', kind: 'boucle', scenique: false }];
  return { pts, cum: cumD, nature, phase, tApex, legs, etapes, total: totalD, schematique: false };
}

/** Phase (aller/retour) au temps t : bascule à l'apex. */
export function phaseAuTemps(modele: ModeleAnim, t: number): Phase {
  return t <= modele.tApex ? 'aller' : 'retour';
}

/**
 * Position [lat, lng] du point mobile au temps t (dans [0, total]), interpolee lineairement le long
 * du trace. Pure et testable ; le composant l'anime image par image (RAF), en s'appuyant sur le TEMPS
 * de trajet (cum), pas la distance (A05). Renvoie null si le modele est vide.
 */
export function positionAuTemps(modele: ModeleAnim, t: number): LL | null {
  const { pts, cum } = modele;
  if (pts.length === 0) return null;
  const premier = pts[0];
  if (pts.length === 1 || !premier) return premier ?? null;
  const cible = Math.max(0, Math.min(t, modele.total));
  for (let i = 1; i < pts.length; i++) {
    const c0 = cum[i - 1] ?? 0;
    const c1 = cum[i] ?? c0;
    if (cible <= c1) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      if (!p0 || !p1) return premier;
      const span = c1 - c0;
      const f = span > 0 ? (cible - c0) / span : 0;
      return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
    }
  }
  return pts[pts.length - 1] ?? premier;
}

/** Mode de déplacement figuré par l'icône du curseur (carte animée, sous-brique 2). */
export type ModeCurseur = 'van' | 'pied' | 'transport' | 'ferry';

export interface EtatCurseur {
  ll: LL;
  mode: ModeCurseur;
  /** Le curseur est au voisinage TEMPOREL d'une étape à nuitée (variante nuit de l'icône). */
  nuit: boolean;
}

/**
 * État du curseur au temps t : position + MODE + NUIT (carte animée M218, sous-brique 2).
 * Mode DÉRIVÉ de la nature du segment courant : 'liaison' (traversée d'eau) → `ferry` ; 'boucle' (terre) → `van`.
 * R1 : `pied` / `transport` ne sont pas encore dans le modèle d'anim (pas de mode par segment) — ils se
 * brancheront ici quand la donnée arrivera (fige/étapes de transit d'A). NUIT = proche en temps d'une nuitée.
 */
export function etatAuTemps(modele: ModeleAnim, t: number): EtatCurseur | null {
  const { pts, cum, nature, etapes, total } = modele;
  const ll = positionAuTemps(modele, t);
  if (!ll) return null;
  const cible = Math.max(0, Math.min(t, total));
  let i = 1;
  for (; i < pts.length; i++) {
    if (cible <= (cum[i] ?? cible)) break;
  }
  const nat = nature[Math.min(i, nature.length - 1)] ?? 'boucle';
  const mode: ModeCurseur = nat === 'liaison' ? 'ferry' : 'van';
  const fenetre = total * 0.04;
  const nuit = etapes.some((e) => e.nuits >= 1 && Math.abs(e.time - cible) < fenetre);
  return { ll, mode, nuit };
}

/**
 * Compte les segments TERRESTRES ('boucle') plus longs que `seuilKm`. C'est la preuve mesurable du
 * gate trajets cote rendu : sur une fige.geom propre, ce compte doit valoir 0 (les grands sauts sont
 * des traversees, classees 'liaison', donc exclues). Un resultat > 0 signale une droite terrestre
 * suspecte (dette DONNEE cote B, pas rendu, cf R05-1).
 */
export function segmentsTerrestresTropLongs(modele: ModeleAnim, seuilKm = 5): number {
  const { pts, nature } = modele;
  let compte = 0;
  for (let i = 1; i < pts.length; i++) {
    // nature[i] qualifie l'arc (pts[i-1], pts[i]) : une traversee ('liaison') est assumee, on l'exclut.
    if (nature[i] === 'liaison') continue;
    const p0 = pts[i - 1];
    const p1 = pts[i];
    if (p0 && p1 && distKm(p0, p1) > seuilKm) compte++;
  }
  return compte;
}

// Profil voyageur UNIQUE (M502/M511) — la « façon de voyager » de chaque membre, modèle canonique MCDA v3 :
// 7 curseurs bipolaires + 4 envies + un cap vers le Nord, tous en [0..1] (défaut 0.5). Une seule vérité par
// voyageur (DB2, GET/PUT /api/philosophie/:code) ; le questionnaire guidé et les curseurs directs écrivent le MÊME
// profil. Les LIBELLÉS viennent du catalogue serveur (A159) ; ce fichier ne fait que fournir un catalogue de
// SECOURS (jamais d'écran vide pour la famille) et les phrases de résumé. R1 : on exprime une préférence, jamais
// un score inventé. Les termes Nouveauté et Tempo existent mais n'agissent pas encore (actifLive:false, dits en clair).

import type {
  CurseurCle,
  EnvieCle,
  CurseurCatalogue,
  EnvieCatalogue,
  PhilosophieProfil,
} from '@barjotur/shared';
import { CURSEUR_CLES, ENVIE_CLES } from '@barjotur/shared';

export type {
  CurseurCle,
  EnvieCle,
  CurseurCatalogue,
  EnvieCatalogue,
  PhilosophieProfil,
} from '@barjotur/shared';
export { CURSEUR_CLES, ENVIE_CLES } from '@barjotur/shared';

/**
 * Catalogue de SECOURS (voix douce, famille). Le serveur renvoie le catalogue canonique (libellés A159) ; on le
 * superpose à celui-ci pour ne jamais afficher un curseur nu si l'endpoint est injoignable. Chaque entrée porte les
 * deux pôles et une phrase d'ancrage lisible par Mamie comme par les enfants.
 */
export const CURSEURS_SECOURS: CurseurCatalogue[] = [
  {
    cle: 'rythme',
    libelle: 'Le rythme',
    poleA: 'Prendre le temps',
    poleB: 'Voir un maximum',
    ancrage: 'À quelle cadence on avance, de la flânerie à la découverte.',
    defaut: 0.5,
    actifLive: true,
  },
  {
    cle: 'registre',
    libelle: 'Nature ou villes',
    poleA: 'La nature',
    poleB: 'Les villes',
    ancrage: 'Vers les grands espaces, ou vers les villes et leur histoire.',
    defaut: 0.5,
    actifLive: true,
  },
  {
    cle: 'nuit',
    libelle: 'Les nuits',
    poleA: 'Tout confort',
    poleB: 'En pleine nature',
    ancrage: 'Des aires équipées aux nuits en autonomie, dans la limite du possible.',
    defaut: 0.5,
    actifLive: true,
  },
  {
    cle: 'foule',
    libelle: 'Les lieux',
    poleA: 'Les incontournables',
    poleB: 'Loin des foules',
    ancrage: 'Les sites connus de tous, ou les coins tranquilles.',
    defaut: 0.5,
    actifLive: true,
  },
  {
    cle: 'nouveaute',
    libelle: 'La nouveauté',
    poleA: 'Les valeurs sûres',
    poleB: 'La surprise',
    ancrage: 'Bientôt actif : doser le goût de la découverte.',
    defaut: 0.5,
    actifLive: false,
  },
  {
    cle: 'effort',
    libelle: "L'effort",
    poleA: 'Balades faciles',
    poleB: 'Grandes randos',
    ancrage: 'Des promenades tranquilles aux longues marches.',
    defaut: 0.5,
    actifLive: true,
  },
  {
    cle: 'tempo',
    libelle: 'Le tempo',
    poleA: 'Un programme cadré',
    poleB: "De la marge pour l'imprévu",
    ancrage: "Bientôt actif : laisser plus ou moins de place à l'imprévu.",
    defaut: 0.5,
    actifLive: false,
  },
];

/** Catalogue de SECOURS des envies (à quel point on a envie de, 0 = peu, 1 = beaucoup). */
export const ENVIES_SECOURS: EnvieCatalogue[] = [
  { cle: 'paysage', libelle: 'Les paysages', defaut: 0.5, actifLive: true },
  { cle: 'rando', libelle: 'La randonnée', defaut: 0.5, actifLive: true },
  { cle: 'nautique', libelle: "L'eau et les bateaux", defaut: 0.5, actifLive: true },
  { cle: 'culturel', libelle: 'La culture', defaut: 0.5, actifLive: true },
];

/** Le cap vers le Nord est un scalaire du profil (pas une entrée de catalogue) : on lui donne ses libellés ici. */
export const CAP_NORD_META = {
  libelle: "L'appel du Grand Nord",
  poleA: 'Rester vers le Sud',
  poleB: 'Filer vers le Nord',
  ancrage: 'Votre envie de pousser vers les Lofoten et au-delà.',
} as const;

/** Phrase d'ancrage des envies (mono-pôle) : à quel point on en a envie. */
const ENVIE_ANCRAGE: Record<EnvieCle, string> = {
  paysage: 'Fjords, montagnes, cascades.',
  rando: 'Marcher, grimper, explorer à pied.',
  nautique: 'Kayak, ferries, baignades, croisières.',
  culturel: 'Musées, villages, patrimoine.',
};

/** Ancrage d'une envie (depuis le catalogue s'il le porte un jour, sinon secours). */
export function ancrageEnvie(cat: EnvieCatalogue): string {
  return ENVIE_ANCRAGE[cat.cle as EnvieCle] ?? '';
}

/** Profil par défaut : tout au milieu (0.5), cap Nord neutre. La vérité de départ tant que rien n'est réglé. */
export function profilDefaut(): PhilosophieProfil {
  return {
    curseurs: Object.fromEntries(CURSEUR_CLES.map((c) => [c, 0.5])) as Record<CurseurCle, number>,
    envies: Object.fromEntries(ENVIE_CLES.map((e) => [e, 0.5])) as Record<EnvieCle, number>,
    cap_nord: 0.5,
  };
}

/**
 * Superpose le catalogue serveur (prioritaire, libellés A159) sur le catalogue de secours, entrée par entrée.
 * Garantit un catalogue complet et lisible même si le serveur n'en renvoie qu'une partie (ou rien). Ordre = secours.
 */
export function fusionnerCatalogue(serveur?: {
  curseurs?: CurseurCatalogue[];
  envies?: EnvieCatalogue[];
}): { curseurs: CurseurCatalogue[]; envies: EnvieCatalogue[] } {
  const parCle = <T extends { cle: string }>(xs?: T[]) =>
    new Map((xs ?? []).map((x) => [x.cle, x] as const));
  const curS = parCle(serveur?.curseurs);
  const envS = parCle(serveur?.envies);
  return {
    curseurs: CURSEURS_SECOURS.map((c) => ({ ...c, ...(curS.get(c.cle) ?? {}) })),
    envies: ENVIES_SECOURS.map((e) => ({ ...e, ...(envS.get(e.cle) ?? {}) })),
  };
}

/** Complète un profil (potentiellement partiel, venu du serveur) sur le défaut : aucune clé manquante. */
export function completerProfil(
  p?: {
    curseurs?: Partial<Record<CurseurCle, number>>;
    envies?: Partial<Record<EnvieCle, number>>;
    cap_nord?: number;
  } | null,
): PhilosophieProfil {
  const base = profilDefaut();
  return {
    curseurs: { ...base.curseurs, ...(p?.curseurs ?? {}) },
    envies: { ...base.envies, ...(p?.envies ?? {}) },
    cap_nord: p?.cap_nord ?? base.cap_nord,
  };
}

/** Résumé humain d'un curseur bipolaire selon sa position (bas → pôle A, milieu → équilibre, haut → pôle B). */
export function resumeCurseur(cat: { poleA: string; poleB: string }, valeur: number): string {
  if (valeur < 0.34) return cat.poleA.toLowerCase();
  if (valeur > 0.66) return cat.poleB.toLowerCase();
  return 'un équilibre';
}

/** Résumé humain d'une envie (mono-pôle) : peu / un peu / beaucoup de <thème>. */
export function resumeEnvie(cat: { libelle: string }, valeur: number): string {
  const t = cat.libelle.toLowerCase();
  if (valeur < 0.34) return `peu ${t}`;
  if (valeur > 0.66) return `beaucoup ${t}`;
  return `un peu ${t}`;
}

/**
 * Synthèse « votre façon de voyager » en une phrase : on ne retient que les curseurs et envies MARQUÉS (loin du
 * milieu), pour dire l'essentiel sans noyer. Rien de marqué = un voyage encore ouvert.
 */
export function syntheseHumaine(
  profil: PhilosophieProfil,
  catalogue: { curseurs: CurseurCatalogue[]; envies: EnvieCatalogue[] },
): string {
  const bouts: string[] = [];
  for (const c of catalogue.curseurs) {
    const v = profil.curseurs[c.cle] ?? 0.5;
    if (Math.abs(v - 0.5) >= 0.2) bouts.push(v > 0.5 ? c.poleB.toLowerCase() : c.poleA.toLowerCase());
  }
  for (const e of catalogue.envies) {
    const v = profil.envies[e.cle as EnvieCle] ?? 0.5;
    if (v >= 0.7) bouts.push(`beaucoup ${e.libelle.toLowerCase()}`);
  }
  if ((profil.cap_nord ?? 0.5) >= 0.7) bouts.push('un cap franc vers le Nord');
  if (bouts.length === 0) return 'Un voyage encore ouvert, sans préférence marquée pour le moment.';
  return `Vous cherchez ${bouts.slice(0, 5).join(', ')}.`;
}

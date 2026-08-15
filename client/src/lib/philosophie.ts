// « Ta façon de voyager » — les 8 axes de philosophie (AUDIT-FRONT P0 #1, Étude Voter). Sliders continus ANCRÉS :
// chaque axe va d'un pôle à l'autre (0 → 100), avec un libellé humain aux deux bouts et une phrase de résumé selon
// la position (aria-valuetext). Cœur de VOTER. Ces axes PONDÈRENT le reward du composeur (MCDA v3) : le profil part
// au composeur (contrat B à poser) ; côté front on collecte, on résume, on persiste. R1 : on n'invente aucun score,
// on exprime une préférence en clair.

export interface AxePhilo {
  /** Clé MCDA (Étude Voter) : interet/nature/antifoule/autonomie/rythme/effort/cout/mobilite. */
  cle: string;
  /** Question douce (ce que l'axe demande). */
  titre: string;
  /** Pôle bas (valeur 0) et pôle haut (valeur 100). */
  gauche: string;
  droite: string;
  /** Résumé humain selon la position (bas / milieu / haut) — pour l'aria-valuetext + le récap. */
  resume: [string, string, string];
}

export const AXES_PHILO: AxePhilo[] = [
  {
    cle: 'interet',
    titre: 'La beauté des paysages',
    gauche: 'Pas ma priorité',
    droite: 'Essentiel',
    resume: ['la beauté compte peu', 'la beauté compte', 'la beauté avant tout'],
  },
  {
    cle: 'nature',
    titre: 'Nature ou ville',
    gauche: 'Nature sauvage',
    droite: 'Les villes',
    resume: ['plutôt la nature sauvage', 'un peu des deux', 'plutôt les villes'],
  },
  {
    cle: 'antifoule',
    titre: 'Le calme, loin des foules',
    gauche: 'Peu importe',
    droite: 'Le calme avant tout',
    resume: ['la foule ne dérange pas', 'un calme raisonnable', 'le calme avant tout'],
  },
  {
    cle: 'autonomie',
    titre: 'Dormir en pleine nature',
    gauche: 'Jamais',
    droite: 'Le plus souvent',
    resume: ['toujours en camping', 'de temps en temps en autonomie', 'le plus souvent en autonomie'],
  },
  {
    cle: 'rythme',
    titre: 'Prendre son temps',
    gauche: 'Voir un max',
    droite: 'Flâner',
    resume: ['voir un maximum de choses', 'un rythme équilibré', 'flâner, sans courir'],
  },
  {
    cle: 'effort',
    titre: 'Envie de randonner',
    gauche: 'Balades faciles',
    droite: 'Grandes randos',
    resume: ['des balades faciles', 'de la marche modérée', 'de grandes randonnées'],
  },
  {
    cle: 'cout',
    titre: 'Le budget',
    gauche: 'Compter chaque euro',
    droite: 'Se faire plaisir',
    resume: ['compter chaque euro', 'un budget raisonnable', 'se faire plaisir'],
  },
  {
    cle: 'mobilite',
    titre: 'Se déplacer autrement',
    gauche: 'Toujours le van',
    droite: 'Vélo et marche',
    resume: ['tout en van', 'un peu de vélo et de marche', 'beaucoup de vélo et de marche'],
  },
];

/** Valeur par défaut (50 = milieu) pour chaque axe. */
export function philoDefaut(): Record<string, number> {
  return Object.fromEntries(AXES_PHILO.map((a) => [a.cle, 50]));
}

/** Résumé humain d'une position (0-100) sur un axe : bas < 34, milieu, haut > 66. */
export function resumeAxe(axe: AxePhilo, valeur: number): string {
  const i = valeur < 34 ? 0 : valeur > 66 ? 2 : 1;
  return axe.resume[i] ?? axe.resume[1] ?? '';
}

/** Phrase de synthèse « votre façon de voyager » : on ne garde que les axes marqués (loin du milieu). */
export function syntheseHumaine(valeurs: Record<string, number>): string {
  const marques = AXES_PHILO.filter((a) => Math.abs((valeurs[a.cle] ?? 50) - 50) >= 20);
  if (marques.length === 0) return 'Un voyage équilibré, sans préférence marquée pour l’instant.';
  const bouts = marques.slice(0, 4).map((a) => resumeAxe(a, valeurs[a.cle] ?? 50));
  return `Vous cherchez ${bouts.join(', ')}.`;
}

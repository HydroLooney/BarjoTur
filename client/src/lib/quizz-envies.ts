// Quizz « Aide-moi à remplir » (M181 §B6), SUR INVITATION : trois questions simples qui pre-remplissent les
// curseurs d'appetit par theme, pour la personne qui ne veut pas les regler un a un. Ce n'est pas un test, on
// n'est pas note (esprit education populaire) : on propose un point de depart, tout reste ajustable ensuite (R1).
// Logique PURE et testable ; l'UI (composant) ne fait que collecter les choix et appeler ce calcul.

export interface OptionQuizz {
  libelle: string;
  /** Thème d'appétit que ce choix pousse (aligné sur la typologie A / themesDemo). */
  theme: string;
}
export interface QuestionQuizz {
  id: string;
  question: string;
  options: OptionQuizz[];
}

export const QUESTIONS_ENVIES: QuestionQuizz[] = [
  {
    id: 'q-eau',
    question: 'Au bord de l’eau, qu’est-ce qui vous tente le plus ?',
    options: [
      { libelle: 'Se baigner', theme: 'baignade' },
      { libelle: 'Pagayer, naviguer', theme: 'nautique' },
      { libelle: 'Admirer le paysage', theme: 'panorama' },
    ],
  },
  {
    id: 'q-journee',
    question: 'Une belle journée, ce serait plutôt…',
    options: [
      { libelle: 'Observer les animaux', theme: 'faune' },
      { libelle: 'Découvrir un lieu d’histoire', theme: 'patrimoine' },
      { libelle: 'Marcher vers un point de vue', theme: 'panorama' },
    ],
  },
  {
    id: 'q-plaisir',
    question: 'Ce qui vous ferait vraiment plaisir…',
    options: [
      { libelle: 'Une baignade en eau vive', theme: 'baignade' },
      { libelle: 'Croiser des macareux ou des rennes', theme: 'faune' },
      { libelle: 'Un musée, un site viking', theme: 'patrimoine' },
    ],
  },
];

/** Tous les thèmes qui apparaissent dans le quizz (pour poser une base a ceux qu'on n'a pas choisis). */
export function themesDuQuizz(): string[] {
  const set = new Set<string>();
  for (const q of QUESTIONS_ENVIES) for (const o of q.options) set.add(o.theme);
  return [...set];
}

const BASE = 0.25; // point de depart doux pour un theme non choisi (on ne met personne a zero d'office)
const PAS = 0.35; // ce qu'un choix ajoute (1 choix = 0,60 ; 2 choix = 0,95)

/**
 * Traduit les thèmes choisis (un par question, doublons possibles) en appétits [0..1] par thème.
 * Chaque thème du quizz part de BASE puis monte de PAS par choix, borné à 1. Résultat pret pour `remplacer`.
 */
export function appetitsDepuisReponses(themesChoisis: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of themesDuQuizz()) out[t] = BASE;
  for (const t of themesChoisis) {
    out[t] = Math.min(1, (out[t] ?? BASE) + PAS);
  }
  return out;
}

// Contrat de la philosophie de voyage (profil par voyageur), canonique MCDA v3 (note 04 curseurs + note 05 envies).
// Posé par le Maître (M412, crible B159) sur le modèle A159. Source unique DB2, lié au membre, versionné et rejouable.
// Remplace l'ancien modèle 8 axes (ex-Étude Voter, caduc). Additif : B branche endpoints + mapping ; C hydrate le
// questionnaire et les curseurs dessus. LIVE = 7 curseurs + 4 envies (th_*) + cap_nord ; le catalogue RPM complet
// (cible/soft/hard, ~11 envies) et les termes Nouveauté/Tempo sont raffinés en v3.1 (hors reward_base live).

/** Les 7 curseurs bipolaires (note 04). Échelle [0..1], défaut 0.5 (neutre). */
export type CurseurCle =
  | 'rythme'      // contemplation ↔ découverte (cadence : nuits par base)
  | 'registre'    // nature ↔ culture
  | 'nuit'        // confort ↔ autonomie (borné budget PPC, note contrainte)
  | 'foule'       // iconique ↔ hors-sentiers
  | 'nouveaute'   // satiété (v3.1 : terme absent du reward_base live)
  | 'effort'      // doux ↔ sportif
  | 'tempo';      // planning serré ↔ marge d'imprévu (v3.1)

/** Les envies (note 05). LIVE = 4 (mappées sur th_*) ; +7 en v3.1 (WOWA-RPM). Échelle [0..1]. */
export type EnvieCle = 'paysage' | 'rando' | 'nautique' | 'culturel';

/** Le profil de philosophie d'un voyageur (source unique DB2, lié membre). */
export interface PhilosophieProfil {
  /** 7 curseurs bipolaires, [0..1], défaut 0.5. */
  curseurs: Record<CurseurCle, number>;
  /** 4 envies live, [0..1], défaut 0.5. */
  envies: Record<EnvieCle, number>;
  /** Tropisme nord (lat_norm / biais_nord), [0..1]. Optionnel. */
  cap_nord?: number;
}

/** Une entrée de catalogue de curseur (rendue par le front pour les libellés, jamais codée en dur). Vient de DB2. */
export interface CurseurCatalogue {
  cle: CurseurCle;
  libelle: string;
  /** Pôle bas (valeur 0) et pôle haut (valeur 1), pour les extrémités du curseur. */
  poleA: string;
  poleB: string;
  /** Phrase d'ancrage / aide affichée sous le curseur. */
  ancrage?: string;
  defaut: number;
  /** Le curseur influence-t-il déjà le composeur live ? (Nouveauté/Tempo = false tant que non câblés, v3.1.) */
  actifLive: boolean;
}

/** Une entrée de catalogue d'envie (libellé humain, unité). Vient de DB2 (envie_catalogue). */
export interface EnvieCatalogue {
  cle: string;
  libelle: string;
  defaut: number;
  actifLive: boolean;
}

/** Réponse de GET /api/philosophie/:code : le catalogue (libellés A159) + le profil courant + sa version. */
export interface PhilosophieReponse {
  catalogue: {
    curseurs: CurseurCatalogue[];
    envies: EnvieCatalogue[];
  };
  profil: PhilosophieProfil;
  /** Version du réglage (versionné, rejouable). Absent si profil par défaut jamais enregistré. */
  version?: number;
}

/** Corps de PUT /api/philosophie/:code : le profil à enregistrer (partiel accepté, fusionné au défaut). */
export interface PhilosophieMajInput {
  curseurs?: Partial<Record<CurseurCle, number>>;
  envies?: Partial<Record<EnvieCle, number>>;
  cap_nord?: number;
}

/** Les clés canoniques, pour valider un profil côté BFF et front (contrat stable). */
export const CURSEUR_CLES: readonly CurseurCle[] = [
  'rythme', 'registre', 'nuit', 'foule', 'nouveaute', 'effort', 'tempo',
];
export const ENVIE_CLES: readonly EnvieCle[] = ['paysage', 'rando', 'nautique', 'culturel'];

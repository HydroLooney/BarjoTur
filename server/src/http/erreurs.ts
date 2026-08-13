// Erreur de requête typée : porte un statut HTTP et un code métier stable, transformés en ApiErreur
// par le middleware d'erreurs. Les messages sont en français, ton sobre (voix R7), destinés à l'utilisateur.

export class ErreurRequete extends Error {
  readonly statut: number;
  readonly code: string;

  constructor(statut: number, code: string, message: string) {
    super(message);
    this.name = 'ErreurRequete';
    this.statut = statut;
    this.code = code;
  }
}

/** Raccourcis pour les cas courants. */
export const Erreurs = {
  codeInconnu: () =>
    new ErreurRequete(404, 'code_inconnu', 'Lien perso inconnu ou inactif.'),
  requeteInvalide: (message: string) =>
    new ErreurRequete(400, 'requete_invalide', message),
  figeIntrouvable: () =>
    new ErreurRequete(404, 'fige_introuvable', 'Itinéraire figé introuvable.'),
} as const;

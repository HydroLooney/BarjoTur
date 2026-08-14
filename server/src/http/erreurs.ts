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

/**
 * Renvoie la valeur si elle est présente, sinon lève l'erreur fournie. Centralise le passage
 * « RPC a renvoyé NULL (cible inconnue) → erreur HTTP » pour ne pas le réécrire dans chaque service.
 */
export function exigerPresent<T>(valeur: T | null | undefined, erreur: () => ErreurRequete): T {
  if (valeur === null || valeur === undefined) {
    throw erreur();
  }
  return valeur;
}

/** Raccourcis pour les cas courants. */
export const Erreurs = {
  codeInconnu: () =>
    new ErreurRequete(404, 'code_inconnu', 'Lien perso inconnu ou inactif.'),
  requeteInvalide: (message: string) =>
    new ErreurRequete(400, 'requete_invalide', message),
  roleInsuffisant: (message = 'Action réservée à un organisateur.') =>
    new ErreurRequete(403, 'role_insuffisant', message),
  figeIntrouvable: () =>
    new ErreurRequete(404, 'fige_introuvable', 'Itinéraire figé introuvable.'),
} as const;

// Middleware d'erreurs : transforme toute exception en ApiErreur (enveloppe unifiée), avec un statut HTTP
// cohérent. Une ErreurRequete porte son statut ; toute autre exception devient un 500 sobre, sans fuite de détail.

import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { ErreurRequete } from '../http/erreurs.js';
import { erreur } from '../http/envelope.js';

/** Emballe un handler asynchrone pour router ses rejets vers le middleware d'erreurs. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Dernier maillon de la chaîne Express : formate l'erreur en ApiErreur. */
export const middlewareErreurs: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErreurRequete) {
    res.status(err.statut).json(erreur(err.code, err.message));
    return;
  }
  // Journalisation serveur (détail technique), réponse cliente sobre (pas de fuite).
  console.error('Erreur non gérée du BFF :', err);
  res.status(500).json(erreur('erreur_interne', 'Une erreur interne est survenue.'));
};

/** 404 pour toute route non montée. */
export const middlewareIntrouvable: RequestHandler = (_req, res) => {
  res.status(404).json(erreur('introuvable', 'Ressource introuvable.'));
};

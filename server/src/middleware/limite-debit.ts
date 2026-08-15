// Limiteur de débit en mémoire (M280 §2, durcissement prod), sans dépendance. Fenêtre fixe par IP : garde-fou anti-abus
// simple, suffisant pour un cercle familial derrière lien perso (pas de cluster multi-instances ; si un jour scale-out,
// remplacer le store par Redis). Horloge injectable pour des tests déterministes. Émet les en-têtes RateLimit-* et un
// 429 enveloppé (ApiErreur) sans appeler next au-delà du plafond.

import type { RequestHandler } from 'express';
import { erreur } from '../http/envelope.js';

export interface OptionsLimite {
  /** Largeur de la fenêtre en millisecondes. */
  fenetreMs: number;
  /** Nombre maximum de requêtes autorisées par IP et par fenêtre. */
  max: number;
  /** Horloge (ms). Injectable pour les tests ; défaut = Date.now. */
  maintenant?: () => number;
  /** Filtre : ne COMPTE que les requêtes dont la méthode passe ce test (les autres passent sans peser). Défaut : tout
   *  compte. Utilisé pour un plafond d'écritures plus strict (mutations POST/PUT/DELETE) que les lectures. */
  compteSi?: (methode: string) => boolean;
}

interface Compteur {
  compte: number;
  resetA: number;
}

/** Construit un middleware de limitation de débit à fenêtre fixe, par IP. */
export function creerLimiteDebit(opts: OptionsLimite): RequestHandler {
  const horloge = opts.maintenant ?? Date.now;
  const store = new Map<string, Compteur>();

  return (req, res, next) => {
    if (opts.compteSi !== undefined && !opts.compteSi(req.method)) {
      next();
      return;
    }
    const cle = req.ip ?? 'inconnue';
    const now = horloge();
    let c = store.get(cle);
    if (c === undefined || now >= c.resetA) {
      c = { compte: 0, resetA: now + opts.fenetreMs };
      store.set(cle, c);
    }
    c.compte += 1;

    const restant = Math.max(0, opts.max - c.compte);
    res.setHeader('RateLimit-Limit', String(opts.max));
    res.setHeader('RateLimit-Remaining', String(restant));
    res.setHeader('RateLimit-Reset', String(Math.ceil((c.resetA - now) / 1000)));

    if (c.compte > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((c.resetA - now) / 1000)));
      res.status(429).json(erreur('trop_de_requetes', 'Trop de requêtes, réessayez plus tard.'));
      return;
    }
    next();
  };
}

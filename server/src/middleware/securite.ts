// En-têtes de sécurité HTTP (M280 §2, durcissement prod), sans dépendance (helmet-lite). Posés sur toutes les réponses.
// L'app est une API JSON derrière lien perso : on refuse le sniffing de type, le cadrage (clickjacking), la fuite de
// referrer, et on isole la ressource cross-origin. HSTS est sûr derrière le proxy TLS (inoffensif en dev http). Pas de
// CSP ici : elle relève du client statique servi ailleurs, pas de cette API.

import type { RequestHandler } from 'express';

export const entetesSecurite: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
};

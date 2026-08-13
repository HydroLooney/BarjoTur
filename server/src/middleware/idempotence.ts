// Idempotence des écritures (amorce C11). Le client envoie un en-tête `Idempotency-Key` (un UUID par intention
// d'écriture) ; on garantit qu'une même intention n'est exécutée qu'une fois et rejoue la même réponse.
//
// Trois garde-fous, appris de la revue de code :
//  1. On ne mémorise QUE les succès (statut < 400) : un échec transitoire (DB2 momentanément indisponible)
//     ne doit pas être figé et rejoué, sinon l'écriture reste bloquée tout le TTL.
//  2. On réserve la clé de façon SYNCHRONE dès l'entrée (avant tout await) : deux envois quasi simultanés de la
//     même clé ne s'exécutent pas deux fois. Le second reçoit 409 tant que le premier est en vol.
//  3. Purge des entrées expirées + plafond de taille : pas de fuite mémoire non bornée (clés fournies par le client).
//
// Portée volontairement en mémoire de process ; la cible durable (survie au redémarrage, partage entre instances)
// vit en DB2, à consolider avec le chantier PWA/idempotence C11.

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { erreur } from '../http/envelope.js';

type Entree =
  | { etat: 'en_cours' }
  | { etat: 'termine'; statut: number; corps: unknown; expire: number };

const memo = new Map<string, Entree>();
const TTL_MS = 10 * 60 * 1000; // 10 min : couvre un rejeu réseau, pas une réintention lointaine.
const MAX_ENTREES = 10_000; // plafond dur, garde-fou contre des clés client abusives.

function purger(maintenant: number): void {
  for (const [cle, e] of memo) {
    if (e.etat === 'termine' && e.expire <= maintenant) memo.delete(cle);
  }
  // Plafond : si on déborde encore, on retire les plus anciennes entrées insérées (ordre d'insertion de Map).
  while (memo.size > MAX_ENTREES) {
    const plusAncienne = memo.keys().next().value;
    if (plusAncienne === undefined) break;
    memo.delete(plusAncienne);
  }
}

export const idempotence: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const cle = req.header('Idempotency-Key');
  if (cle === undefined || cle.trim() === '') {
    next();
    return;
  }
  const maintenant = Date.now();
  purger(maintenant);

  const connue = memo.get(cle);
  if (connue !== undefined) {
    if (connue.etat === 'termine') {
      res.status(connue.statut).json(connue.corps);
    } else {
      // Première requête encore en vol : on ne réexécute pas l'écriture.
      res.status(409).json(erreur('requete_en_cours', 'Une requête identique est déjà en cours de traitement.'));
    }
    return;
  }

  // Réservation synchrone (avant tout await du handler) : ferme la fenêtre de double exécution.
  memo.set(cle, { etat: 'en_cours' });

  let corps: unknown;
  let corpsCapture = false;
  const jsonOriginal = res.json.bind(res);
  res.json = (payload: unknown) => {
    corps = payload;
    corpsCapture = true;
    return jsonOriginal(payload);
  };

  // À la fin de la réponse : mémoriser si succès, libérer la clé sinon (retour possible en cas d'erreur transitoire).
  res.on('finish', () => {
    if (corpsCapture && res.statusCode < 400) {
      memo.set(cle, { etat: 'termine', statut: res.statusCode, corps, expire: Date.now() + TTL_MS });
    } else {
      memo.delete(cle);
    }
  });

  next();
};

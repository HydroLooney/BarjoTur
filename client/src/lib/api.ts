import type { ApiReponse } from '@barjotur/shared';

// Client reseau UNIQUE de l'app. AUCUN composant n'appelle fetch en direct : tout passe ici
// (frontiere PWA-ready A06/C11). Ainsi, brancher un cache offline ou Capacitor plus tard ne
// touche pas l'UI. Toutes les reponses du BFF sont dans l'enveloppe ApiReponse<T> du socle shared.

const BASE = '/api';

/** Erreur applicative renvoyee par le BFF (enveloppe ok:false). */
export class ErreurApi extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

// Idempotency-Key pour les ecritures (B004) : une meme mutation rejouee (reseau capricieux, PWA)
// ne produit pas d'effet en double cote serveur.
function cleIdempotence(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

async function requete<T>(chemin: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(`${BASE}${chemin}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  // Le BFF repond TOUJOURS dans l'enveloppe ApiReponse (meme une erreur metier = HTTP 200). Une
  // reponse non-JSON (page d'erreur proxy, 502, rate-limit) ou hors enveloppe = panne reseau/infra :
  // on l'encapsule en ErreurApi plutot que de laisser fuiter une SyntaxError/TypeError vers react-query.
  let brut: unknown;
  try {
    brut = await reponse.json();
  } catch {
    throw new ErreurApi('reseau', `Réponse non-JSON (HTTP ${reponse.status})`);
  }
  if (!brut || typeof (brut as { ok?: unknown }).ok !== 'boolean') {
    throw new ErreurApi('reseau', `Réponse hors contrat (HTTP ${reponse.status})`);
  }
  const corps = brut as ApiReponse<T>;
  if (!corps.ok) throw new ErreurApi(corps.erreur.code, corps.erreur.message);
  return corps.data;
}

export const api = {
  get: <T>(chemin: string): Promise<T> => requete<T>(chemin),
  put: <T>(chemin: string, corps: unknown): Promise<T> =>
    requete<T>(chemin, { method: 'PUT', body: JSON.stringify(corps) }),
  /** POST ; `idempotent` ajoute un en-tete Idempotency-Key (ecritures de vote, cf B004). */
  post: <T>(chemin: string, corps: unknown, opts?: { idempotent?: boolean }): Promise<T> =>
    requete<T>(chemin, {
      method: 'POST',
      body: JSON.stringify(corps),
      headers: opts?.idempotent ? { 'Idempotency-Key': cleIdempotence() } : undefined,
    }),
};

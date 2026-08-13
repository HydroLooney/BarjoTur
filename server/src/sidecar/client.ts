// Client HTTP typé du sidecar composeur Python (OR-Tools).
// Le BFF ne fait que déléguer au sidecar ; il ne connaît pas OR-Tools.
// L'URL du sidecar vient de l'environnement (SIDECAR_URL, secrets.env, jamais en dur).
//
// Règle de production : le sidecar répond sous 120s (A* live par leg). Le timeout est réglé
// en conséquence. Toute erreur réseau est propagée pour qu'un 503 remonte au front.

import { lireEnv } from '../env.js';
import type { ComposeReponse } from '../domain/composeur.js';

/** Appelle GET /health du sidecar. Sert au /health du BFF pour indiquer si le composeur est up. */
export async function santesSidecar(): Promise<{ ok: boolean; ortools: string | null; bases: number }> {
  const url = `${lireEnv().sidecarUrl}/health`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    return { ok: false, ortools: null, bases: 0 };
  }
  return res.json() as Promise<{ ok: boolean; ortools: string | null; bases: number }>;
}

/** Corps de la requête POST /compose du sidecar. Aligné sur le modèle Pydantic ComposeReq. */
export interface ComposeReqSidecar {
  bases: number[];
  archetype_key?: string | null;
  avec_agenda?: boolean;
  avec_geom?: boolean;
  persister?: boolean;
}

/**
 * Appelle POST /compose du sidecar.
 * Propagation directe de l'erreur si le sidecar est injoignable (503 côté BFF).
 * Le timeout est long (A* live peut prendre jusqu'à 120s).
 */
export async function composerViaSidecar(corps: ComposeReqSidecar): Promise<ComposeReponse> {
  const url = `${lireEnv().sidecarUrl}/compose`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(150_000), // 150s > timeout A* (120s) + marge
  });
  if (!res.ok) {
    const texte = await res.text().catch(() => '(corps illisible)');
    throw new Error(`Sidecar composeur a répondu ${res.status} : ${texte.slice(0, 200)}`);
  }
  return res.json() as Promise<ComposeReponse>;
}

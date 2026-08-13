// Enveloppe de réponse unifiée. Le front ne dépend que du contrat api.* (ApiReponse), jamais du schéma brut.
// Source du contrat : @barjotur/shared (socle posé par le Maître).

import type { ApiOk, ApiErreur, ApiReponse } from '@barjotur/shared';

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function erreur(code: string, message: string): ApiErreur {
  return { ok: false, erreur: { code, message } };
}

export type { ApiReponse };

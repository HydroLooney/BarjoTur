// Enveloppe de réponse standard du BFF. Le front ne dépend que des contrats api.* (jamais du schéma brut).

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErreur {
  ok: false;
  erreur: {
    code: string;
    message: string;
  };
}

export type ApiReponse<T> = ApiOk<T> | ApiErreur;

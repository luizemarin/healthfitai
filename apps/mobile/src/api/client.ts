import createClient from 'openapi-fetch';

import { refreshSession } from '../auth/auth';
import { config } from '../config';
import { ApiError } from './api-error';
import { sessionStore } from '../session/session-store';

import type { Middleware } from 'openapi-fetch';

import type { Session } from '../session/session-store';
import type { paths } from './generated/schema';

/**
 * Client HTTP tipado pelo contrato OpenAPI da API (apps/api/openapi.json).
 * Rotas, parâmetros, corpos e respostas vêm do tipo `paths`, gerado por `npm run api:types`.
 *
 *   const feedbacks = await unwrap(api.GET('/feedbacks'));
 *
 * `publicApi` não envia token: use para rotas abertas (ex.: convite).
 * `api` envia o token da sessão e renova a sessão automaticamente quando recebe 401.
 */
export const publicApi = createClient<paths>({ baseUrl: config.apiUrl });
export const api = createClient<paths>({ baseUrl: config.apiUrl });

let refreshInFlight: Promise<Session | null> | null = null;

/**
 * Renova a sessão uma única vez, mesmo com várias requisições recebendo 401 ao mesmo tempo.
 * Se não der para renovar, encerra a sessão: o app volta para o login sozinho (guard no _layout).
 */
async function renewSession(): Promise<Session | null> {
  const current = sessionStore.get();
  if (!current) {
    return null;
  }

  refreshInFlight ??= refreshSession(current.refreshToken)
    .then((session) => {
      sessionStore.set(session);
      return session;
    })
    .catch(() => {
      sessionStore.clear();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function withToken(request: Request, accessToken: string): Request {
  request.headers.set('Authorization', `Bearer ${accessToken}`);
  return request;
}

// Cópia de cada requisição, para repetir depois do refresh (o corpo original já foi consumido).
const retryCopies = new WeakMap<Request, Request>();

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const session = sessionStore.get();
    if (!session) {
      return request;
    }
    withToken(request, session.accessToken);
    retryCopies.set(request, request.clone());
    return request;
  },

  async onResponse({ request, response }) {
    const copy = retryCopies.get(request);
    if (response.status !== 401 || !copy) {
      return response;
    }

    const session = await renewSession();
    if (!session) {
      return response;
    }

    // Repete uma única vez com o token novo.
    const retried = await fetch(withToken(copy, session.accessToken));
    if (retried.status === 401) {
      sessionStore.clear();
    }
    return retried;
  },
};

api.use(authMiddleware);

/**
 * Devolve o `data` da resposta ou lança ApiError, para as telas lidarem com um único formato.
 * Ex.: const feedbacks = await unwrap(api.GET('/feedbacks'));
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch {
    throw ApiError.network();
  }

  const { data, error, response } = result;
  if (!response.ok) {
    throw ApiError.fromResponse(response.status, error);
  }
  return data as T;
}

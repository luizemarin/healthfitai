import createClient from 'openapi-fetch';

import { config } from '../config';
import { ApiError } from './api-error';

import type { paths } from './generated/schema';

/**
 * Client HTTP tipado pelo contrato OpenAPI da API (apps/api/openapi.json).
 * Rotas, parâmetros, corpos e respostas vêm do tipo `paths`, gerado por `npm run api:types`.
 *
 *   const feedbacks = await unwrap(api.GET('/feedbacks'));
 *
 * Token e renovação de sessão entram com o login (MB-AUT-02), via `api.use(...)`.
 */
export const api = createClient<paths>({ baseUrl: config.apiUrl });

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

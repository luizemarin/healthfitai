import { ApiError } from '../api/api-error';
import { config } from '../config';
import { isSession, sessionStore } from '../session/session-store';

import type { Session } from '../session/session-store';

/**
 * Login, logout e renovação da sessão do aluno.
 *
 * PROVISÓRIO: as rotas de autenticação (BE-AUT-01 / BE-AUT-03) ainda não estão no OpenAPI, então
 * o contrato está escrito aqui. Quando entrarem, troque `post(...)` por `publicApi.POST(...)` e
 * só este arquivo muda; telas e client continuam iguais.
 */
const AUTH_ROUTES = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
} as const;

async function post(path: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw ApiError.network();
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw ApiError.fromResponse(response.status, data);
  }
  return data;
}

/** Garante que a API devolveu o par de tokens antes de guardar. */
function toSession(data: unknown): Session {
  if (!isSession(data)) {
    throw new ApiError(500, 'INVALID_SESSION', 'Resposta de login inválida.');
  }
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

/** Entra com e-mail e senha. Erro → ApiError (401 = credenciais erradas, 0 = sem conexão). */
export async function signIn(email: string, senha: string): Promise<void> {
  const data = await post(AUTH_ROUTES.login, { email, senha });
  sessionStore.set(toSession(data));
}

/** Troca o refresh token por uma sessão nova (usado pelo client ao receber 401). */
export async function refreshSession(refreshToken: string): Promise<Session> {
  return toSession(await post(AUTH_ROUTES.refresh, { refreshToken }));
}

/**
 * Sai do app. Apaga os tokens do aparelho na hora (funciona sem internet) e avisa a API para
 * revogar o refresh token; se o aviso falhar, o token vence sozinho.
 */
export async function signOut(): Promise<void> {
  const session = sessionStore.get();
  sessionStore.clear();

  if (session) {
    await post(AUTH_ROUTES.logout, { refreshToken: session.refreshToken }).catch(() => {});
  }
}

import { z } from 'zod';

import { AppError } from '../errors/app-error';

import type { Request } from 'express';

/**
 * Identifica o profissional dono da requisição.
 *
 * PROVISÓRIO até o login existir (BE-AUT-01 / BE-AUT-05): por enquanto o id vem
 * no header `X-Profissional-Id`. Quando o token chegar, só o corpo de
 * getProfissionalId muda (passa a ler o id do token); os módulos não mudam.
 * Não usar em produção: qualquer cliente pode enviar o id de outro profissional.
 */
export const PROFISSIONAL_HEADER = 'x-profissional-id';

const profissionalIdSchema = z.uuid();

/** Header documentado no contrato OpenAPI das rotas que dependem do profissional. */
export const profissionalHeaderSchema = z.object({
  [PROFISSIONAL_HEADER]: profissionalIdSchema.meta({
    description: 'Id do profissional (provisório até o login, BE-AUT-01).',
  }),
});

export function getProfissionalId(request: Request): string {
  const value = request.get(PROFISSIONAL_HEADER)?.trim();

  if (!value) {
    throw AppError.unauthorized(
      'Profissional não identificado. Envie o header X-Profissional-Id com o id do profissional.',
    );
  }

  const result = profissionalIdSchema.safeParse(value);
  if (!result.success) {
    throw AppError.validation([
      { field: `headers.${PROFISSIONAL_HEADER}`, message: 'Deve ser um UUID válido.' },
    ]);
  }

  return result.data;
}

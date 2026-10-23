import { z } from 'zod';

import type { ResponseConfig } from '@asteasolutions/zod-to-openapi';

/** Payload único de erro de toda a API (fonte do contrato e do tipo). */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string().meta({ example: 'Dados de entrada inválidos.' }),
      details: z
        .array(
          z.object({
            field: z.string().meta({ example: 'body.email' }),
            message: z.string().meta({ example: 'Formato de e-mail inválido' }),
          }),
        )
        .optional(),
    }),
  })
  .meta({ id: 'ErrorResponse', description: 'Formato único de erro da API.' });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

const ERROR_DESCRIPTIONS = {
  400: 'Requisição inválida (validação, JSON malformado).',
  401: 'Não autenticado.',
  403: 'Sem permissão.',
  404: 'Recurso não encontrado.',
  409: 'Conflito.',
  413: 'Payload muito grande.',
  500: 'Erro interno.',
} as const;

type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

/**
 * Respostas de erro para o `responses` de uma rota no OpenAPI.
 * Ex.: responses: { 200: {...}, ...errorResponses(400, 404) } — o 500 entra sempre.
 */
export function errorResponses(...statuses: ErrorStatus[]): Record<string, ResponseConfig> {
  const unique = [...new Set<ErrorStatus>([...statuses, 500])];

  return Object.fromEntries(
    unique.map((status) => [
      String(status),
      {
        description: ERROR_DESCRIPTIONS[status],
        content: { 'application/json': { schema: errorResponseSchema } },
      },
    ]),
  );
}

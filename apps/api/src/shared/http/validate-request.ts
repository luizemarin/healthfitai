import { AppError } from '../errors/app-error';
import { zodErrorToDetails } from '../errors/error-handler';

import type { Request } from 'express';
import type { z } from 'zod';

import type { ErrorDetail } from '../errors/app-error';

interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type ValidatedRequest<S extends RequestSchemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

const LOCATIONS = ['params', 'query', 'body'] as const;

/**
 * Valida params/query/body com os schemas Zod da rota e devolve os dados já tipados
 * e normalizados (coerção, defaults, trim). Junta os erros das três origens em um
 * único erro VALIDATION_ERROR (400). Use no controller:
 *
 *   const { params, body } = validateRequest(request, { params: idParamsSchema, body: createSchema });
 *
 * É uma função (e não middleware) porque no Express 5 `req.query` é somente leitura
 * e assim o tipo validado chega direto ao controller, sem cast.
 */
export function validateRequest<S extends RequestSchemas>(
  request: Request,
  schemas: S,
): ValidatedRequest<S> {
  const details: ErrorDetail[] = [];
  const data: Record<string, unknown> = {};

  LOCATIONS.forEach((location) => {
    const schema = schemas[location];
    if (!schema) {
      return;
    }
    const result = schema.safeParse(request[location]);
    if (result.success) {
      data[location] = result.data;
    } else {
      details.push(...zodErrorToDetails(result.error, location));
    }
  });

  if (details.length > 0) {
    throw AppError.validation(details);
  }

  return data as ValidatedRequest<S>;
}

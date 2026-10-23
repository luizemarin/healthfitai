import { z } from 'zod';

import { AppError, ErrorCodes } from './app-error';

import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { ErrorDetail } from './app-error';
import type { ErrorResponse } from './error.schema';

/** Converte issues do Zod em details, prefixando a origem ("body", "query"...). */
export function zodErrorToDetails(error: z.ZodError, location?: string): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: [location, ...issue.path.map(String)].filter(Boolean).join('.') || '(raiz)',
    message: issue.message,
  }));
}

/** Erros lançados pelo express.json() (body-parser) carregam `type` e `status`. */
function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    error instanceof Error &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return AppError.validation(zodErrorToDetails(error));
  }
  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return new AppError(400, ErrorCodes.INVALID_JSON, 'JSON malformado no corpo da requisição.');
    }
    if (error.type === 'entity.too.large') {
      return new AppError(413, ErrorCodes.PAYLOAD_TOO_LARGE, 'Corpo da requisição muito grande.');
    }
    if (error.status >= 400 && error.status < 500) {
      return new AppError(error.status, ErrorCodes.BAD_REQUEST, 'Requisição inválida.');
    }
  }
  return new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Erro interno do servidor.');
}

function toErrorResponse({ code, message, details }: AppError): ErrorResponse {
  return { error: details?.length ? { code, message, details: [...details] } : { code, message } };
}

/** 404 padrão para rotas inexistentes (registrar depois de todas as rotas). */
export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      ErrorCodes.ROUTE_NOT_FOUND,
      `Rota não encontrada: ${request.method} ${request.path}`,
    ),
  );
};

/**
 * Middleware final: todo erro (lançado em handler sync/async no Express 5) vira o payload único.
 * Erros 5xx não expõem mensagem nem stack ao cliente; o detalhe vai só para o log.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const appError = toAppError(error);

  if (appError.status >= 500) {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`[erro] ${request.method} ${request.originalUrl}: ${detail}\n`);
  }

  response.status(appError.status).json(toErrorResponse(appError));
};

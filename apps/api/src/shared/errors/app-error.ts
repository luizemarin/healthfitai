/** Códigos de erro comuns. Módulos podem usar códigos próprios (ex.: 'INVITE_EXPIRED'). */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Problema pontual de um campo. `field` indica a origem: "body.email", "query.page" etc. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Erro de aplicação: tudo que vira resposta HTTP de erro passa por aqui.
 * O service lança (ex.: `throw AppError.notFound('Aluno não encontrado.')`) e o
 * errorHandler converte no payload único, sem o service conhecer Express.
 */
export class AppError extends Error {
  public readonly status: number;

  public readonly code: string;

  public readonly details: readonly ErrorDetail[] | undefined;

  constructor(status: number, code: string, message: string, details?: readonly ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(
    details: readonly ErrorDetail[],
    message = 'Dados de entrada inválidos.',
  ): AppError {
    return new AppError(400, ErrorCodes.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Autenticação necessária.'): AppError {
    return new AppError(401, ErrorCodes.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Acesso negado.'): AppError {
    return new AppError(403, ErrorCodes.FORBIDDEN, message);
  }

  static notFound(message = 'Recurso não encontrado.'): AppError {
    return new AppError(404, ErrorCodes.NOT_FOUND, message);
  }

  static conflict(message = 'Conflito com o estado atual do recurso.'): AppError {
    return new AppError(409, ErrorCodes.CONFLICT, message);
  }
}

/** Problema pontual de um campo (espelha o ErrorResponse da API). */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Corpo de erro da API: { error: { code, message, details? } } (errorResponseSchema no back). */
interface ErrorBody {
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}

function isErrorBody(value: unknown): value is ErrorBody {
  const error = (value as Partial<ErrorBody> | null)?.error;
  return typeof error?.code === 'string' && typeof error.message === 'string';
}

/**
 * Erro único do front para qualquer falha de chamada à API.
 * As telas tratam só esta classe: `status` 0 = sem conexão; demais = status HTTP.
 */
export class ApiError extends Error {
  public readonly status: number;

  public readonly code: string;

  public readonly details: readonly ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Converte a resposta de erro da API (ou algo inesperado) em ApiError. */
  static fromResponse(status: number, body: unknown): ApiError {
    if (isErrorBody(body)) {
      const { code, message, details } = body.error;
      return new ApiError(status, code, message, details);
    }
    return new ApiError(status, 'UNEXPECTED_ERROR', 'Erro inesperado ao falar com o servidor.');
  }

  static network(): ApiError {
    return new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }
}

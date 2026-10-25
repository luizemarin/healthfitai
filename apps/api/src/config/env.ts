import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  /** Endereço que o aluno abre para ativar a conta; o token vai em ?token=... (BE-ALU-04). */
  CONVITE_URL_BASE: z.url().default('http://localhost:8081/convite'),
  /** Por quantas horas o link de convite vale (padrão: 7 dias). */
  CONVITE_VALIDADE_HORAS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(24 * 7),
});

export type Env = Readonly<z.infer<typeof envSchema>>;

export class EnvValidationError extends Error {
  public readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Variáveis de ambiente inválidas:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Valida e normaliza as variáveis de ambiente.
 * Recebe a fonte explicitamente (em vez de ler process.env) para ser testável.
 * Reporta todos os problemas de uma vez, não só o primeiro.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // Valor vazio ("PORT=") é tratado como ausente, caindo no default.
  const normalized = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = envSchema.safeParse(normalized);

  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`),
    );
  }

  return Object.freeze(result.data);
}

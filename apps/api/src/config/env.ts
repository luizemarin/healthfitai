import { z } from 'zod';

/** Variáveis do storage de fotos (BE-FOT-02): ou vêm todas, ou nenhuma. */
const STORAGE_OBRIGATORIAS = [
  'STORAGE_ENDPOINT',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
] as const;

export const envSchema = z
  .object({
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

    /**
     * BE-FOT-02 · Storage compatível com S3 (Cloudflare R2), bucket PRIVADO.
     * Sem estas variáveis a API sobe normalmente, mas as rotas de envio e
     * visualização de fotos respondem 503 STORAGE_NAO_CONFIGURADO.
     */
    STORAGE_ENDPOINT: z.url().optional(),
    STORAGE_BUCKET: z.string().trim().min(3).max(63).optional(),
    STORAGE_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    /** No R2 é sempre "auto". */
    STORAGE_REGION: z.string().trim().min(1).default('auto'),
    /** Tamanho máximo do arquivo enviado pelo app/painel, em MB. */
    FOTO_TAMANHO_MAXIMO_MB: z.coerce.number().int().min(1).max(25).default(10),
    /** Validade das URLs assinadas para VER as fotos (1 a 5 min; LG-SEG-03). */
    FOTO_URL_VALIDADE_SEGUNDOS: z.coerce.number().int().min(60).max(300).default(300),
  })
  .superRefine((env, ctx) => {
    const faltando = STORAGE_OBRIGATORIAS.filter((nome) => env[nome] === undefined);
    if (faltando.length > 0 && faltando.length < STORAGE_OBRIGATORIAS.length) {
      faltando.forEach((nome) => {
        ctx.addIssue({
          code: 'custom',
          path: [nome],
          message: 'Obrigatória quando o storage de fotos está configurado (STORAGE_*).',
        });
      });
    }
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

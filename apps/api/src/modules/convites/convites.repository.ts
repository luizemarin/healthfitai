/**
 * Contrato de acesso a dados de convites (tabela convites, DB-005).
 * Hoje a implementação é em memória; com o Prisma entra outra implementação
 * desta mesma interface, sem mexer no service.
 *
 * Regras que o repositório respeita (iguais às da migration):
 *   - guarda só o hash do token, nunca o token puro;
 *   - nada é apagado nem sobrescrito: revogar só preenche revogadoEm.
 */

export const STATUS_CONVITE = ['valido', 'usado', 'revogado', 'expirado'] as const;

export type StatusConvite = (typeof STATUS_CONVITE)[number];

export interface Convite {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  alunoId: string;
  /** SHA-256 do token, em hex (64 caracteres). */
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
  criadoEm: Date;
}

export type NovoConvite = Pick<Convite, 'alunoId' | 'tokenHash' | 'expiraEm'>;

/**
 * Estado do convite, calculado pelas datas (não existe coluna "status").
 * Ordem importa: usado/revogado valem mesmo depois de vencido.
 */
export function statusDoConvite(convite: Convite, agora: Date = new Date()): StatusConvite {
  if (convite.usadoEm) {
    return 'usado';
  }
  if (convite.revogadoEm) {
    return 'revogado';
  }
  return convite.expiraEm > agora ? 'valido' : 'expirado';
}

export interface ConvitesRepository {
  create: (dados: NovoConvite) => Promise<Convite>;
  /** Convites do aluno, do mais novo para o mais antigo. */
  listByAluno: (alunoId: string) => Promise<Convite[]>;
  /** Convite ainda válido do aluno (no máximo um), ou null. */
  findValidoByAluno: (alunoId: string, agora: Date) => Promise<Convite | null>;
  /** Revoga os convites válidos do aluno. Retorna quantos foram revogados. */
  revogarValidos: (alunoId: string, agora: Date) => Promise<number>;
}

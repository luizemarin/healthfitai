import type { RECORRENCIAS, STATUS_FEEDBACK } from './feedbacks.schemas';
import type { SortOrder } from '../../shared/http/pagination';

/**
 * Contrato de acesso a dados dos feedbacks. O service só conhece esta
 * interface; hoje a implementação é em memória e, com as tabelas
 * feedback_agendamentos (DB-011), feedback_envios (DB-012) e
 * feedback_comentarios (DB-013), entra a implementação com Prisma sem mexer
 * no service.
 *
 * Toda leitura feita pelo profissional recebe o alunoId: registro de outro
 * aluno = "não encontrado". (Quem garante que o aluno é do profissional é o
 * service, pelo AlunosRepository.)
 */

export type Recorrencia = (typeof RECORRENCIAS)[number];
export type StatusFeedback = (typeof STATUS_FEEDBACK)[number];

// ─── Agendamentos (BE-FBK-01) ───────────────────────────────────────────────

export interface AgendamentoFeedback {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  alunoId: string;
  modeloId: string;
  recorrencia: Recorrencia;
  /** Quando o job (BE-FBK-02) libera o próximo feedback. */
  proximaLiberacao: Date;
  /** BE-FBK-03 · null = sem lembrete. */
  lembreteDias: number | null;
  /** Desativar em vez de apagar: os feedbacks antigos continuam apontando para cá. */
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovoAgendamento = Pick<
  AgendamentoFeedback,
  'alunoId' | 'modeloId' | 'recorrencia' | 'proximaLiberacao' | 'lembreteDias'
>;

/** Campos alteráveis; `undefined` = não alterar. */
export type AlteracoesAgendamento = {
  [K in 'recorrencia' | 'proximaLiberacao' | 'lembreteDias' | 'ativo']?:
    AgendamentoFeedback[K] | undefined;
};

export type AgendamentoSortField = 'proximaLiberacao' | 'criadoEm';

export interface FiltrosListagemAgendamentos {
  ativo?: boolean | undefined;
  sort: SortOrder<AgendamentoSortField>;
  skip: number;
  take: number;
}

export interface PaginaAgendamentos {
  items: AgendamentoFeedback[];
  total: number;
}

// ─── Feedbacks enviados (BE-FBK-04) ─────────────────────────────────────────

/** Uma liberação de um agendamento (linha de feedback_envios). */
export interface EnvioFeedback {
  id: string;
  agendamentoId: string;
  /** Vem do agendamento (JOIN, com o Prisma). */
  alunoId: string;
  /** Vem do agendamento (JOIN, com o Prisma). */
  modeloId: string;
  /** Vem do agendamento (JOIN). Usado para calcular o lembrete (BE-FBK-03). */
  lembreteDias: number | null;
  /** null até o aluno começar a responder. */
  submissaoId: string | null;
  status: StatusFeedback;
  /** Datas = fatos: cada uma registra QUANDO aquilo aconteceu (null = ainda não). */
  enviadoEm: Date | null;
  lembreteEm: Date | null;
  respondidoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  /** Com o Prisma: _count de feedback_comentarios. */
  totalComentarios: number;
}

/**
 * Uma transição de status já validada pela máquina (feedbacks.status.ts),
 * com a data do fato que ela registra. O banco confere que status e datas
 * combinam (CHECKs do DB-012).
 */
export type MudancaStatus =
  | { para: 'enviado'; enviadoEm: Date }
  | { para: 'atrasado'; lembreteEm: Date }
  | { para: 'respondido'; respondidoEm: Date; submissaoId: string };

export type EnvioSortField = 'criadoEm' | 'enviadoEm';

export interface FiltrosListagemEnvios {
  status?: StatusFeedback | undefined;
  agendamentoId?: string | undefined;
  sort: SortOrder<EnvioSortField>;
  skip: number;
  take: number;
}

export interface PaginaEnvios {
  items: EnvioFeedback[];
  total: number;
}

/**
 * Lançado quando o status no banco não é mais o que o service leu (ex.: o aluno
 * respondeu no mesmo instante em que o job mandava o lembrete). Com o Prisma:
 * UPDATE ... WHERE id = ? AND status = <esperado>, que não atualiza nenhuma linha.
 */
export class StatusFeedbackAlteradoError extends Error {
  public readonly statusAtual: StatusFeedback;

  constructor(statusAtual: StatusFeedback) {
    super(`O status do feedback mudou para "${statusAtual}".`);
    this.name = 'StatusFeedbackAlteradoError';
    this.statusAtual = statusAtual;
  }
}

// ─── Comentários (BE-FBK-05) ────────────────────────────────────────────────

/** Nunca é alterado: corrigir = escrever outro (por isso não há atualizadoEm). */
export interface ComentarioFeedback {
  id: string;
  envioId: string;
  profissionalId: string;
  texto: string;
  criadoEm: Date;
}

export type NovoComentario = Pick<ComentarioFeedback, 'envioId' | 'profissionalId' | 'texto'>;

// ─── Contrato ───────────────────────────────────────────────────────────────

export interface FeedbacksRepository {
  createAgendamento: (dados: NovoAgendamento) => Promise<AgendamentoFeedback>;
  findAgendamento: (alunoId: string, id: string) => Promise<AgendamentoFeedback | null>;
  /** Agendamento ATIVO do aluno com aquele modelo (para não duplicar envios). */
  findAgendamentoAtivo: (alunoId: string, modeloId: string) => Promise<AgendamentoFeedback | null>;
  /** Retorna null se não existir. */
  updateAgendamento: (
    alunoId: string,
    id: string,
    alteracoes: AlteracoesAgendamento,
  ) => Promise<AgendamentoFeedback | null>;
  listAgendamentos: (
    alunoId: string,
    filtros: FiltrosListagemAgendamentos,
  ) => Promise<PaginaAgendamentos>;

  findEnvio: (alunoId: string, id: string) => Promise<EnvioFeedback | null>;
  /** Uso interno (jobs e fluxo de resposta), sem o filtro de aluno. */
  findEnvioPorId: (id: string) => Promise<EnvioFeedback | null>;
  listEnvios: (alunoId: string, filtros: FiltrosListagemEnvios) => Promise<PaginaEnvios>;
  /**
   * BE-FBK-04 · Aplica a transição só se o status atual ainda for `de`.
   * Retorna null se não existir. @throws StatusFeedbackAlteradoError
   */
  mudarStatus: (
    id: string,
    de: StatusFeedback,
    mudanca: MudancaStatus,
  ) => Promise<EnvioFeedback | null>;
  /**
   * BE-FBK-03 · Feedbacks 'enviado' de agendamentos ATIVOS com lembrete, cujo
   * prazo (enviadoEm + lembreteDias) já chegou em `agora`. Usa o índice (status, enviado_em).
   */
  listLembretesVencidos: (agora: Date) => Promise<EnvioFeedback[]>;

  createComentario: (dados: NovoComentario) => Promise<ComentarioFeedback>;
  /** Comentários do feedback, do mais antigo para o mais novo. */
  listComentarios: (envioId: string) => Promise<ComentarioFeedback[]>;
}

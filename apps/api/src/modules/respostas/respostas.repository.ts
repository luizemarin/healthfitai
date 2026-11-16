import type { PREENCHIDO_POR, STATUS_SUBMISSAO } from './respostas.schemas';
import type { SortOrder } from '../../shared/http/pagination';
import type { TipoModelo } from '../questionarios/questionarios.repository';

/**
 * Contrato de acesso a dados das respostas. O service só conhece esta
 * interface; hoje a implementação é em memória e, com as tabelas submissoes
 * (DB-009) e respostas (DB-010), entra a implementação com Prisma sem mexer
 * no service.
 *
 * Toda leitura recebe o alunoId: uma submissão de outro aluno = "não encontrada".
 * (Quem garante que o aluno é do profissional é o service, pelo AlunosRepository.)
 *
 * BE-RSP-01 · Nada é sobrescrito: só o rascunho muda. Depois de final, a
 * submissão é somente leitura; responder de novo cria OUTRA submissão.
 */

export type StatusSubmissao = (typeof STATUS_SUBMISSAO)[number];
export type PreenchidoPor = (typeof PREENCHIDO_POR)[number];

/** Valor já validado contra o tipo da pergunta (ver respostas.valores.ts). */
export type ValorResposta = string | number | boolean | string[];

export interface Resposta {
  perguntaId: string;
  valor: ValorResposta;
}

export interface Submissao {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  alunoId: string;
  modeloId: string;
  /** Tipo do modelo (não muda). Com o Prisma vem do JOIN com modelos_questionario. */
  tipo: TipoModelo;
  /** Versão do modelo no momento em que o preenchimento começou (BE-QST-04). */
  versao: number;
  status: StatusSubmissao;
  preenchidoPor: PreenchidoPor;
  /** null no rascunho; obrigatório no final. */
  respondidoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  respostas: Resposta[];
}

export type NovaSubmissao = Pick<
  Submissao,
  'alunoId' | 'modeloId' | 'tipo' | 'versao' | 'preenchidoPor'
>;

/** Alteração do autosave: valor null = apagar a resposta daquela pergunta. */
export interface AlteracaoResposta {
  perguntaId: string;
  valor: ValorResposta | null;
}

export type SubmissaoSortField = 'respondidoEm';

export interface FiltrosListagemSubmissoes {
  tipo?: TipoModelo | undefined;
  modeloId?: string | undefined;
  de?: Date | undefined;
  ate?: Date | undefined;
  sort: SortOrder<SubmissaoSortField>;
  skip: number;
  take: number;
}

export interface PaginaSubmissoes {
  items: Submissao[];
  total: number;
}

/**
 * Lançado ao tentar alterar uma submissão que já é final (ex.: o aluno enviou
 * no celular enquanto o autosave do computador ainda chegava). Com o Prisma:
 * UPDATE ... WHERE status = 'rascunho', que não atualiza nenhuma linha.
 */
export class SubmissaoFinalizadaError extends Error {
  constructor() {
    super('A submissão já foi finalizada.');
    this.name = 'SubmissaoFinalizadaError';
  }
}

export interface RespostasRepository {
  /** Cria a submissão como rascunho, sem respostas. */
  create: (dados: NovaSubmissao) => Promise<Submissao>;
  findById: (alunoId: string, id: string) => Promise<Submissao | null>;
  /** BE-RSP-02 · Rascunho em aberto do aluno para aquele modelo (no máximo um). */
  findRascunho: (alunoId: string, modeloId: string) => Promise<Submissao | null>;
  /**
   * Grava/apaga respostas do rascunho (numa transação, no banco).
   * Retorna null se não existir. @throws SubmissaoFinalizadaError
   */
  salvarRespostas: (id: string, alteracoes: AlteracaoResposta[]) => Promise<Submissao | null>;
  /** Rascunho → final. Retorna null se não existir. @throws SubmissaoFinalizadaError */
  finalizar: (id: string, respondidoEm: Date) => Promise<Submissao | null>;
  /** BE-RSP-04 · Só submissões finais do aluno. */
  list: (alunoId: string, filtros: FiltrosListagemSubmissoes) => Promise<PaginaSubmissoes>;
}

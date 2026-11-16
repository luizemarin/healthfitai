import type { SortOrder } from '../../shared/http/pagination';

/**
 * Contrato de acesso a dados de treinos (DB-023) e execuções (DB-024). O service
 * só conhece esta interface; hoje a implementação é em memória e, com o Prisma,
 * entra a implementação com banco sem mexer no service.
 *
 * As tabelas não têm profissional_id: o dono é o profissional do ALUNO. Por isso
 * o service confere o aluno (AlunosRepository) antes de devolver qualquer coisa;
 * aqui as consultas são por id/alunoId.
 */

// ─── BE-TRE-01 · Treinos ────────────────────────────────────────────────────

/** Exercício prescrito dentro do treino (treino_exercicios). */
export interface ItemTreino {
  id: string;
  exercicioId: string;
  /** Posição no treino: 1, 2, 3... */
  ordem: number;
  series: number;
  /** Texto curto: "12", "8-12", "até a falha". */
  repeticoes: string;
  /** 0 = sem descanso. */
  descansoSegundos: number;
  /** Nulo = sem carga prescrita (ex.: peso do corpo). No banco: DECIMAL(6,2) → number. */
  cargaKg: number | null;
}

export interface Treino {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  alunoId: string;
  nome: string;
  /** Remover = desativar: as execuções antigas continuam apontando para ele. */
  ativo: boolean;
  /** Sempre na ordem (ordem 1, 2, 3...). */
  itens: ItemTreino[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovoItemTreino = Omit<ItemTreino, 'id'>;

export interface NovoTreino {
  alunoId: string;
  nome: string;
  itens: NovoItemTreino[];
}

/** Ausente = não alterar. `itens` substitui a lista inteira (o editor manda o treino todo). */
export interface AlteracoesTreino {
  nome?: string | undefined;
  itens?: NovoItemTreino[] | undefined;
}

export type TreinoSortField = 'nome' | 'criadoEm';

export interface FiltrosListagemTreinos {
  /** Busca no nome do treino. */
  q?: string | undefined;
  sort: SortOrder<TreinoSortField>;
  skip: number;
  take: number;
}

export interface PaginaTreinos {
  items: Treino[];
  total: number;
}

// ─── BE-TRE-02 · Execuções ──────────────────────────────────────────────────

/** Uma série feita (series_execucao). Aponta para o exercício, não para o item do treino. */
export interface SerieExecucao {
  id: string;
  exercicioId: string;
  /** Nº da série: 1, 2, 3... */
  serie: number;
  /** Repetições feitas de verdade. */
  repeticoes: number;
  /** Carga usada. Nulo = sem carga. */
  cargaKg: number | null;
  /** Descanso feito depois desta série. Nulo = não medido (ex.: última série). */
  descansoSegundos: number | null;
}

/** Um treino feito pelo aluno. Nasce completo ao finalizar e nunca é alterado. */
export interface ExecucaoTreino {
  id: string;
  alunoId: string;
  treinoId: string;
  iniciadoEm: Date;
  duracaoSegundos: number;
  series: SerieExecucao[];
  criadoEm: Date;
}

export interface NovaExecucaoTreino {
  alunoId: string;
  treinoId: string;
  iniciadoEm: Date;
  duracaoSegundos: number;
  series: Omit<SerieExecucao, 'id'>[];
}

// ─── Contrato ───────────────────────────────────────────────────────────────

export interface TreinosRepository {
  /** Cria o treino com os itens de uma vez (no banco: uma transação). */
  criarTreino: (dados: NovoTreino) => Promise<Treino>;
  /** Inclui os removidos (ativo = false): o service decide se aceita. Null se não existir. */
  buscarTreino: (id: string) => Promise<Treino | null>;
  /** Só os ativos do aluno. */
  listarTreinos: (alunoId: string, filtros: FiltrosListagemTreinos) => Promise<PaginaTreinos>;
  /** Só treino ativo. Retorna null se não existir ou estiver removido. */
  atualizarTreino: (id: string, alteracoes: AlteracoesTreino) => Promise<Treino | null>;
  /** Exclusão lógica. Retorna false se não havia treino ativo para remover. */
  desativarTreino: (id: string) => Promise<boolean>;

  /** Cria a execução com as séries de uma vez (no banco: uma transação). */
  criarExecucao: (dados: NovaExecucaoTreino) => Promise<ExecucaoTreino>;
  buscarExecucao: (id: string) => Promise<ExecucaoTreino | null>;
  /** Execução já registrada para o treino com este mesmo início (reenvio do app). */
  buscarExecucaoPorInicio: (treinoId: string, iniciadoEm: Date) => Promise<ExecucaoTreino | null>;
  /** Todas as execuções do aluno, por início crescente. Usado pelo painel (BE-DSH-01). */
  listarExecucoesDoAluno: (alunoId: string) => Promise<ExecucaoTreino[]>;
}

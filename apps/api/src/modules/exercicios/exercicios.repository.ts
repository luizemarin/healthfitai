import type { SortOrder } from '../../shared/http/pagination';

/**
 * Contrato de acesso a dados da biblioteca de exercícios (DB-022). O service só
 * conhece esta interface; hoje a implementação é em memória e, com o Prisma,
 * entra a implementação com banco sem mexer no service.
 *
 * Toda operação recebe o profissionalId: exercício de outro profissional
 * = "não encontrado". Excluídos (ativo = false) também não aparecem: buscar,
 * listar e atualizar só enxergam os ativos.
 */

export interface Exercicio {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  profissionalId: string;
  nome: string;
  grupoMuscular: string;
  /** Sem descrição = null, nunca "". */
  descricao: string | null;
  /** Link https de vídeo/imagem de demonstração. */
  midiaUrl: string | null;
  /** Excluir = desativar: treinos e execuções antigas continuam apontando para ele. */
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovoExercicio = Pick<
  Exercicio,
  'profissionalId' | 'nome' | 'grupoMuscular' | 'descricao' | 'midiaUrl'
>;

/** Campos alteráveis; ausente (undefined) = não alterar; null = limpar. */
export type AlteracoesExercicio = {
  [K in 'nome' | 'grupoMuscular' | 'descricao' | 'midiaUrl']?: Exercicio[K] | undefined;
};

export type ExercicioSortField = 'nome' | 'criadoEm';

export interface FiltrosListagemExercicios {
  /** Busca no nome e no grupo muscular. */
  q?: string | undefined;
  grupoMuscular?: string | undefined;
  sort: SortOrder<ExercicioSortField>;
  skip: number;
  take: number;
}

export interface PaginaExercicios {
  items: Exercicio[];
  total: number;
}

export interface ExerciciosRepository {
  create: (dados: NovoExercicio) => Promise<Exercicio>;
  /** Retorna null se não existir, for de outro profissional ou estiver excluído. */
  findById: (profissionalId: string, id: string) => Promise<Exercicio | null>;
  /**
   * Exercícios do profissional com estes ids, INCLUINDO os excluídos (com ativo).
   * Usado por treinos e execuções, que continuam mostrando o nome de um
   * exercício excluído depois. Ids de outro profissional ou inexistentes ficam de fora.
   */
  findByIds: (profissionalId: string, ids: readonly string[]) => Promise<Exercicio[]>;
  /** Só os ativos do profissional. */
  list: (profissionalId: string, filtros: FiltrosListagemExercicios) => Promise<PaginaExercicios>;
  /** Exercício ativo do profissional com este nome (sem diferenciar maiúsculas/acentos), se houver. */
  findAtivoPorNome: (profissionalId: string, nome: string) => Promise<Exercicio | null>;
  /** Retorna null se não existir, for de outro profissional ou estiver excluído. */
  update: (
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesExercicio,
  ) => Promise<Exercicio | null>;
  /** Exclusão lógica (ativo = false). Retorna false se não havia exercício ativo para excluir. */
  desativar: (profissionalId: string, id: string) => Promise<boolean>;
}

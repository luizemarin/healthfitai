import type { SortOrder } from '../../shared/http/pagination';

/**
 * Contrato de acesso a dados dos planos nutricionais (DB-025). O service só
 * conhece esta interface; hoje a implementação é em memória e, com o Prisma,
 * entra a implementação com banco sem mexer no service.
 *
 * As tabelas não têm profissional_id: o dono é o profissional do ALUNO. Por isso
 * o service confere o aluno (AlunosRepository) antes de devolver qualquer coisa.
 */

/** Refeição do plano (planos_nutricionais_itens). */
export interface RefeicaoPlano {
  id: string;
  /** Posição no plano: 1, 2, 3... */
  ordem: number;
  /** Ex.: "Café da manhã". */
  refeicao: string;
  /** "HH:MM". Nulo = sem horário sugerido. No banco: TIME(0). */
  horario: string | null;
  /** Alimentos e quantidades em texto livre. */
  descricao: string;
}

export interface PlanoNutricional {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  alunoId: string;
  nome: string;
  observacoes: string | null;
  /** Plano em uso. O aluno tem no máximo um ativo; os antigos ficam no histórico. */
  ativo: boolean;
  /** Sempre na ordem (ordem 1, 2, 3...). */
  refeicoes: RefeicaoPlano[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovaRefeicaoPlano = Omit<RefeicaoPlano, 'id'>;

export interface NovoPlanoNutricional {
  alunoId: string;
  nome: string;
  observacoes: string | null;
  refeicoes: NovaRefeicaoPlano[];
}

/** Ausente = não alterar. `refeicoes` substitui a lista inteira. */
export interface AlteracoesPlano {
  nome?: string | undefined;
  observacoes?: string | null | undefined;
  refeicoes?: NovaRefeicaoPlano[] | undefined;
}

export type PlanoSortField = 'criadoEm' | 'nome';

export interface FiltrosListagemPlanos {
  /** Busca no nome do plano. */
  q?: string | undefined;
  /** Sem o filtro: ativos e antigos. */
  ativo?: boolean | undefined;
  sort: SortOrder<PlanoSortField>;
  skip: number;
  take: number;
}

export interface PaginaPlanos {
  items: PlanoNutricional[];
  total: number;
}

export interface NutricaoRepository {
  /**
   * Desativa o plano ativo do aluno (se houver) e cria o novo, de uma vez
   * (no banco: uma transação). Assim o aluno nunca fica com dois planos ativos.
   */
  criarPlano: (dados: NovoPlanoNutricional) => Promise<PlanoNutricional>;
  /** Inclui os inativos: o service decide se aceita. Null se não existir. */
  buscarPlano: (id: string) => Promise<PlanoNutricional | null>;
  /** O plano em uso do aluno, ou null se ele não tiver. */
  buscarPlanoAtivo: (alunoId: string) => Promise<PlanoNutricional | null>;
  listarPlanos: (alunoId: string, filtros: FiltrosListagemPlanos) => Promise<PaginaPlanos>;
  /** Só plano ativo. Retorna null se não existir ou estiver inativo. */
  atualizarPlano: (id: string, alteracoes: AlteracoesPlano) => Promise<PlanoNutricional | null>;
  /** Encerrar = desativar. Retorna false se não havia plano ativo com esse id. */
  desativarPlano: (id: string) => Promise<boolean>;
}

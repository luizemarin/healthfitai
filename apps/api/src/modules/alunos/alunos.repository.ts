import type { SEXOS } from './alunos.schemas';
import type { SortOrder } from '../../shared/http/pagination';

/**
 * Contrato de acesso a dados de alunos. O service só conhece esta interface;
 * hoje a implementação é em memória e, com a tabela alunos (DB-004), entra a
 * implementação com Prisma sem mexer no service.
 *
 * Toda operação recebe o profissionalId: um profissional nunca enxerga aluno
 * de outro (aluno de outro profissional = "não encontrado").
 */

export type Sexo = (typeof SEXOS)[number];

export interface Aluno {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  profissionalId: string;
  nome: string;
  sexo: Sexo;
  /** AAAA-MM-DD */
  dataNascimento: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovoAluno = Pick<
  Aluno,
  'profissionalId' | 'nome' | 'sexo' | 'dataNascimento' | 'email' | 'telefone'
>;

/** Campos editáveis; `undefined` = não alterar. */
export type AlteracoesAluno = {
  [K in 'nome' | 'sexo' | 'dataNascimento' | 'email' | 'telefone']?: Aluno[K] | undefined;
};

export type AlunoSortField = 'nome' | 'criadoEm';

export interface FiltrosListagemAlunos {
  q?: string | undefined;
  ativo?: boolean | undefined;
  sexo?: Sexo | undefined;
  sort: SortOrder<AlunoSortField>;
  skip: number;
  take: number;
}

export interface PaginaAlunos {
  items: Aluno[];
  total: number;
}

/** Lançado quando o profissional já tem um aluno com o mesmo e-mail. */
export class EmailAlunoDuplicadoError extends Error {
  constructor() {
    super('Já existe um aluno com este e-mail para este profissional.');
    this.name = 'EmailAlunoDuplicadoError';
  }
}

export interface AlunosRepository {
  /** @throws EmailAlunoDuplicadoError */
  create: (dados: NovoAluno) => Promise<Aluno>;
  findById: (profissionalId: string, id: string) => Promise<Aluno | null>;
  /** Retorna null se o aluno não existir. @throws EmailAlunoDuplicadoError */
  update: (
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesAluno,
  ) => Promise<Aluno | null>;
  list: (profissionalId: string, filtros: FiltrosListagemAlunos) => Promise<PaginaAlunos>;
  /** Ativa ou desativa (nunca apaga). Retorna null se o aluno não existir. */
  definirAtivo: (profissionalId: string, id: string, ativo: boolean) => Promise<Aluno | null>;
}

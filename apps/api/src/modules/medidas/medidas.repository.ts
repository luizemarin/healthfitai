import type { PAPEIS, Unidade } from './medidas.schemas';

/**
 * Contrato de acesso a dados de peso (DB-016) e medidas (DB-017). O service só
 * conhece esta interface; hoje a implementação é em memória e, com o Prisma,
 * entra a implementação com banco sem mexer no service.
 *
 * Tipos de medida: toda operação recebe o profissionalId (tipo de outro
 * profissional = "não encontrado"). Registros: o service confere antes que o
 * aluno é do profissional; aqui as consultas são por alunoId.
 *
 * Registros nunca são alterados nem apagados: mediu de novo = novo registro.
 */

export type Papel = (typeof PAPEIS)[number];

export interface TipoMedida {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  profissionalId: string;
  nome: string;
  /** Vale para todos os registros do tipo: uma curva sempre numa unidade só. */
  unidade: Unidade;
  /** Remover = desativar: o histórico continua apontando para o tipo. */
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovoTipoMedida = Pick<TipoMedida, 'profissionalId' | 'nome' | 'unidade'>;

/** Campos alteráveis; ausente = não alterar. */
export type AlteracoesTipoMedida = Partial<Pick<TipoMedida, 'nome' | 'unidade' | 'ativo'>>;

export interface RegistroPeso {
  id: string;
  alunoId: string;
  /** Quilos, até 2 casas. No banco: DECIMAL(5,2) → converter para number. */
  pesoKg: number;
  /** AAAA-MM-DD */
  dataRegistro: string;
  registradoPor: Papel;
  criadoEm: Date;
}

export type NovoRegistroPeso = Omit<RegistroPeso, 'id' | 'criadoEm'>;

export interface RegistroMedida {
  id: string;
  alunoId: string;
  tipoId: string;
  /** Na unidade do tipo, até 2 casas. No banco: DECIMAL(10,2) → converter para number. */
  valor: number;
  /** AAAA-MM-DD */
  dataRegistro: string;
  registradoPor: Papel;
  criadoEm: Date;
}

export type NovoRegistroMedida = Omit<RegistroMedida, 'id' | 'criadoEm'>;

export interface FiltrosHistorico {
  /** AAAA-MM-DD, inclusive. */
  de?: string | undefined;
  /** AAAA-MM-DD, inclusive. */
  ate?: string | undefined;
  /** Por dataRegistro; no mesmo dia, por criadoEm na mesma direção. */
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

export interface FiltrosHistoricoMedidas extends FiltrosHistorico {
  tipoId?: string | undefined;
}

export interface Pagina<T> {
  items: T[];
  total: number;
}

export interface MedidasRepository {
  // ─── Tipos de medida (BE-MED-02) ────────────────────────────────────────

  /**
   * Se o profissional ainda não tem nenhum tipo, copia os padrão do sistema
   * para ele. Se já tem, não faz nada.
   * No banco: numa transação, lendo os tipos com profissional_id NULL.
   */
  garantirTiposIniciais: (profissionalId: string) => Promise<void>;
  /** Todos os tipos do profissional (ativos e inativos), por ordem de criação. */
  listarTipos: (profissionalId: string) => Promise<TipoMedida[]>;
  criarTipo: (dados: NovoTipoMedida) => Promise<TipoMedida>;
  /** Retorna null se o tipo não existir para o profissional. */
  atualizarTipo: (
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesTipoMedida,
  ) => Promise<TipoMedida | null>;
  /** Se já existe algum registro (de qualquer aluno) com este tipo. */
  tipoTemRegistros: (tipoId: string) => Promise<boolean>;

  // ─── Registros (BE-MED-01) ──────────────────────────────────────────────

  criarRegistroPeso: (dados: NovoRegistroPeso) => Promise<RegistroPeso>;
  listarRegistrosPeso: (
    alunoId: string,
    filtros: FiltrosHistorico,
  ) => Promise<Pagina<RegistroPeso>>;
  /**
   * Grava todas as medidas de um lançamento juntas: ou todas, ou nenhuma.
   * No banco: numa transação. Retorna na mesma ordem recebida.
   */
  criarRegistrosMedida: (dados: readonly NovoRegistroMedida[]) => Promise<RegistroMedida[]>;
  listarRegistrosMedida: (
    alunoId: string,
    filtros: FiltrosHistoricoMedidas,
  ) => Promise<Pagina<RegistroMedida>>;
}

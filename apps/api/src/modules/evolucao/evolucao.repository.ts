import type { Unidade } from '../medidas/medidas.schemas';
import type { ModeloQuestionario, Pergunta } from '../questionarios/questionarios.repository';

/**
 * Contrato de LEITURA da evolução (BE-EVO-01). Só consulta; nada é gravado aqui.
 * O service agrupa as leituras em séries; o repositório só entrega os valores
 * do aluno no período.
 *
 * Hoje a implementação é em memória (lê os repositórios de medidas, respostas
 * e questionários). Com o Prisma vira SQL direto nas tabelas registros_peso,
 * registros_medida, submissoes + respostas + perguntas — o mesmo SQL que a IA
 * vai usar depois (BE-IA-07).
 *
 * O service confere antes que o aluno é do profissional.
 */

/** Período em dias AAAA-MM-DD (horário de Brasília), ambos inclusive. Ausente = sem limite. */
export interface Periodo {
  de?: string | undefined;
  ate?: string | undefined;
}

/** O que toda leitura tem: o dia do valor e o momento exato (desempate no mesmo dia). */
export interface LeituraBase {
  /** AAAA-MM-DD, horário de Brasília. */
  data: string;
  /** Mais de um valor no mesmo dia: vale o de momento mais recente. */
  momento: Date;
  valor: number;
}

export type LeituraPeso = LeituraBase;

export interface LeituraMedida extends LeituraBase {
  tipo: { id: string; nome: string; unidade: Unidade; ativo: boolean };
}

export interface LeituraPergunta extends LeituraBase {
  submissaoId: string;
  modelo: Pick<ModeloQuestionario, 'id' | 'nome' | 'tipo'>;
  /** A pergunta como estava na versão respondida (BE-QST-04). */
  pergunta: Pick<Pergunta, 'id' | 'tipo' | 'enunciado' | 'unidade' | 'min' | 'max'>;
}

export interface EvolucaoRepository {
  /** Pesagens (DB-016). No banco: data = data_registro; momento = criado_em. */
  listarPesos: (alunoId: string, periodo: Periodo) => Promise<LeituraPeso[]>;
  /** Medidas com o tipo (DB-017), inclusive de tipos desativados. */
  listarMedidas: (
    profissionalId: string,
    alunoId: string,
    periodo: Periodo,
  ) => Promise<LeituraMedida[]>;
  /**
   * Respostas numéricas de perguntas com "exibir no gráfico" (BE-QST-03), só de
   * submissões FINAIS. No banco: data = (respondido_em AT TIME ZONE
   * 'America/Sao_Paulo')::date; momento = respondido_em; valor = valor_numero.
   */
  listarRespostasEvolucao: (
    profissionalId: string,
    alunoId: string,
    periodo: Periodo,
  ) => Promise<LeituraPergunta[]>;
}

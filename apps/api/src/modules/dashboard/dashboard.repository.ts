/**
 * Contrato de LEITURA do painel (BE-DSH-01). Só consulta; nada é gravado aqui.
 * O service calcula as métricas; o repositório só entrega os treinos feitos.
 *
 * Hoje a implementação é em memória (lê o repositório de treinos). Com o Prisma
 * vira SQL direto em execucoes_treino + series_execucao, usando o índice
 * (aluno_id, iniciado_em) que o DB-024 já criou para o painel.
 *
 * O service confere antes que os alunos são do profissional.
 */

/** Período em dias AAAA-MM-DD (horário de Brasília), ambos inclusive. */
export interface Periodo {
  de: string;
  ate: string;
}

/** Só o que o painel usa de cada série feita. */
export interface LeituraSerie {
  exercicioId: string;
  /** Nulo = série sem carga (ex.: peso do corpo). */
  cargaKg: number | null;
}

/** Um treino finalizado pelo aluno (BE-TRE-02). */
export interface LeituraExecucao {
  alunoId: string;
  /** AAAA-MM-DD, horário de Brasília. No banco: (iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date. */
  data: string;
  iniciadoEm: Date;
  series: LeituraSerie[];
}

export interface DashboardRepository {
  /** Treinos dos alunos iniciados no período, em ordem de início crescente. */
  listarExecucoes: (alunoIds: readonly string[], periodo: Periodo) => Promise<LeituraExecucao[]>;
  /**
   * Início do último treino de cada aluno, em qualquer data (não depende do período).
   * Aluno que nunca treinou fica fora do Map. No banco: MAX(iniciado_em) GROUP BY aluno_id.
   */
  buscarUltimosTreinos: (alunoIds: readonly string[]) => Promise<Map<string, Date>>;
}

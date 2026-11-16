import { diaEmBrasilia } from './dashboard.periodo';

import type { DashboardRepository, LeituraExecucao, Periodo } from './dashboard.repository';
import type { TreinosRepository } from '../treinos/treinos.repository';

/**
 * Implementação em memória, PROVISÓRIA até o Prisma. Não guarda nada: lê as
 * execuções do repositório de treinos (BE-TRE-02).
 */
export class InMemoryDashboardRepository implements DashboardRepository {
  private readonly treinos: TreinosRepository;

  constructor(treinos: TreinosRepository) {
    this.treinos = treinos;
  }

  async listarExecucoes(
    alunoIds: readonly string[],
    { de, ate }: Periodo,
  ): Promise<LeituraExecucao[]> {
    const porAluno = await Promise.all(
      alunoIds.map(async (alunoId) => this.treinos.listarExecucoesDoAluno(alunoId)),
    );

    // Filtra o período pelo dia em Brasília (e não pelo instante UTC).
    return porAluno
      .flat()
      .map((execucao) => ({
        alunoId: execucao.alunoId,
        data: diaEmBrasilia(execucao.iniciadoEm),
        iniciadoEm: execucao.iniciadoEm,
        series: execucao.series.map(({ exercicioId, cargaKg }) => ({ exercicioId, cargaKg })),
      }))
      .filter(({ data }) => data >= de && data <= ate)
      .sort((a, b) => a.iniciadoEm.getTime() - b.iniciadoEm.getTime());
  }

  async buscarUltimosTreinos(alunoIds: readonly string[]): Promise<Map<string, Date>> {
    const ultimos = await Promise.all(
      alunoIds.map(async (alunoId) => {
        const execucoes = await this.treinos.listarExecucoesDoAluno(alunoId);
        return [alunoId, execucoes.at(-1)?.iniciadoEm] as const;
      }),
    );

    return new Map(
      ultimos.flatMap(([alunoId, iniciadoEm]) =>
        iniciadoEm ? [[alunoId, iniciadoEm] as const] : [],
      ),
    );
  }
}

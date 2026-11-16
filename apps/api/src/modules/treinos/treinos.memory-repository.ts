import { randomUUID } from 'node:crypto';

import type {
  AlteracoesTreino,
  ExecucaoTreino,
  FiltrosListagemTreinos,
  NovaExecucaoTreino,
  NovoItemTreino,
  NovoTreino,
  PaginaTreinos,
  Treino,
  TreinosRepository,
} from './treinos.repository';

/** Compara textos sem diferenciar maiúsculas, acentos e espaços nas pontas. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Gera os ids dos itens e garante a ordem (o banco devolve ordenado pelo índice único). */
function comIds(itens: NovoItemTreino[]): Treino['itens'] {
  return itens.map((item) => ({ ...item, id: randomUUID() })).sort((a, b) => a.ordem - b.ordem);
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma (tabelas treinos,
 * treino_exercicios, execucoes_treino e series_execucao). Os dados somem ao
 * reiniciar a API. Imita o banco: gera os UUIDs, remover treino é lógico
 * (ativo = false) e execução nunca é alterada.
 */
export class InMemoryTreinosRepository implements TreinosRepository {
  private readonly treinos = new Map<string, Treino>();

  private readonly execucoes = new Map<string, ExecucaoTreino>();

  // ─── Treinos ──────────────────────────────────────────────────────────────

  async criarTreino(dados: NovoTreino): Promise<Treino> {
    const agora = new Date();
    const treino: Treino = {
      id: randomUUID(),
      alunoId: dados.alunoId,
      nome: dados.nome,
      ativo: true,
      itens: comIds(dados.itens),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.treinos.set(treino.id, treino);
    return structuredClone(treino);
  }

  async buscarTreino(id: string): Promise<Treino | null> {
    const treino = this.treinos.get(id);
    return treino ? structuredClone(treino) : null;
  }

  async listarTreinos(alunoId: string, filtros: FiltrosListagemTreinos): Promise<PaginaTreinos> {
    const termo = filtros.q === undefined ? undefined : normalizar(filtros.q);

    const encontrados = [...this.treinos.values()].filter(
      (treino) =>
        treino.alunoId === alunoId &&
        treino.ativo &&
        (termo === undefined || normalizar(treino.nome).includes(termo)),
    );

    const { field, direction } = filtros.sort;
    const sinal = direction === 'asc' ? 1 : -1;
    encontrados.sort((a, b) => {
      const comparacao =
        field === 'nome'
          ? a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
          : a.criadoEm.getTime() - b.criadoEm.getTime();
      // Desempate pelo id: a ordem fica estável entre páginas.
      return sinal * comparacao || a.id.localeCompare(b.id);
    });

    return {
      items: encontrados
        .slice(filtros.skip, filtros.skip + filtros.take)
        .map((treino) => structuredClone(treino)),
      total: encontrados.length,
    };
  }

  async atualizarTreino(id: string, alteracoes: AlteracoesTreino): Promise<Treino | null> {
    const treino = this.treinos.get(id);
    if (!treino?.ativo) {
      return null;
    }

    const atualizado: Treino = {
      ...treino,
      nome: alteracoes.nome ?? treino.nome,
      itens: alteracoes.itens === undefined ? treino.itens : comIds(alteracoes.itens),
      atualizadoEm: new Date(),
    };
    this.treinos.set(id, atualizado);
    return structuredClone(atualizado);
  }

  async desativarTreino(id: string): Promise<boolean> {
    const treino = this.treinos.get(id);
    if (!treino?.ativo) {
      return false;
    }
    this.treinos.set(id, { ...treino, ativo: false, atualizadoEm: new Date() });
    return true;
  }

  // ─── Execuções ────────────────────────────────────────────────────────────

  async criarExecucao(dados: NovaExecucaoTreino): Promise<ExecucaoTreino> {
    const execucao: ExecucaoTreino = {
      ...dados,
      id: randomUUID(),
      series: dados.series.map((serie) => ({ ...serie, id: randomUUID() })),
      criadoEm: new Date(),
    };
    this.execucoes.set(execucao.id, execucao);
    return structuredClone(execucao);
  }

  async buscarExecucao(id: string): Promise<ExecucaoTreino | null> {
    const execucao = this.execucoes.get(id);
    return execucao ? structuredClone(execucao) : null;
  }

  async buscarExecucaoPorInicio(
    treinoId: string,
    iniciadoEm: Date,
  ): Promise<ExecucaoTreino | null> {
    const execucao = [...this.execucoes.values()].find(
      (item) => item.treinoId === treinoId && item.iniciadoEm.getTime() === iniciadoEm.getTime(),
    );
    return execucao ? structuredClone(execucao) : null;
  }

  async listarExecucoesDoAluno(alunoId: string): Promise<ExecucaoTreino[]> {
    return [...this.execucoes.values()]
      .filter((execucao) => execucao.alunoId === alunoId)
      .sort((a, b) => a.iniciadoEm.getTime() - b.iniciadoEm.getTime())
      .map((execucao) => structuredClone(execucao));
  }
}

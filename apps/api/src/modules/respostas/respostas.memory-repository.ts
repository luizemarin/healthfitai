import { randomUUID } from 'node:crypto';

import { SubmissaoFinalizadaError } from './respostas.repository';

import type {
  AlteracaoResposta,
  FiltrosListagemSubmissoes,
  NovaSubmissao,
  PaginaSubmissoes,
  RespostasRepository,
  Submissao,
} from './respostas.repository';

function dentroDoPeriodo(data: Date, de: Date | undefined, ate: Date | undefined): boolean {
  const tempo = data.getTime();
  return (
    (de === undefined || tempo >= de.getTime()) && (ate === undefined || tempo <= ate.getTime())
  );
}

/**
 * Implementação em memória, PROVISÓRIA até as tabelas no banco.
 * Os dados somem ao reiniciar a API. Imita o banco: gera os UUIDs e só deixa
 * alterar submissões em rascunho. Devolve sempre cópias (nunca a referência).
 */
export class InMemoryRespostasRepository implements RespostasRepository {
  private readonly submissoes = new Map<string, Submissao>();

  async create(dados: NovaSubmissao): Promise<Submissao> {
    const agora = new Date();
    const submissao: Submissao = {
      id: randomUUID(),
      ...dados,
      status: 'rascunho',
      respondidoEm: null,
      criadoEm: agora,
      atualizadoEm: agora,
      respostas: [],
    };

    this.submissoes.set(submissao.id, submissao);
    return structuredClone(submissao);
  }

  async findById(alunoId: string, id: string): Promise<Submissao | null> {
    const submissao = this.submissoes.get(id);
    return submissao?.alunoId === alunoId ? structuredClone(submissao) : null;
  }

  async findRascunho(alunoId: string, modeloId: string): Promise<Submissao | null> {
    const rascunho = [...this.submissoes.values()].find(
      (item) =>
        item.alunoId === alunoId && item.modeloId === modeloId && item.status === 'rascunho',
    );
    return rascunho ? structuredClone(rascunho) : null;
  }

  async salvarRespostas(id: string, alteracoes: AlteracaoResposta[]): Promise<Submissao | null> {
    const submissao = this.submissoes.get(id);
    if (!submissao) {
      return null;
    }
    if (submissao.status !== 'rascunho') {
      throw new SubmissaoFinalizadaError();
    }

    const porPergunta = new Map(submissao.respostas.map((item) => [item.perguntaId, item]));
    alteracoes.forEach(({ perguntaId, valor }) => {
      if (valor === null) {
        porPergunta.delete(perguntaId);
      } else {
        porPergunta.set(perguntaId, { perguntaId, valor });
      }
    });

    const atualizada: Submissao = {
      ...submissao,
      respostas: [...porPergunta.values()],
      atualizadoEm: new Date(),
    };
    this.submissoes.set(id, atualizada);

    return structuredClone(atualizada);
  }

  async finalizar(id: string, respondidoEm: Date): Promise<Submissao | null> {
    const submissao = this.submissoes.get(id);
    if (!submissao) {
      return null;
    }
    if (submissao.status !== 'rascunho') {
      throw new SubmissaoFinalizadaError();
    }

    const finalizada: Submissao = {
      ...submissao,
      status: 'final',
      respondidoEm,
      atualizadoEm: new Date(),
    };
    this.submissoes.set(id, finalizada);

    return structuredClone(finalizada);
  }

  async list(alunoId: string, filtros: FiltrosListagemSubmissoes): Promise<PaginaSubmissoes> {
    const encontradas = [...this.submissoes.values()].filter(
      (item): item is Submissao & { respondidoEm: Date } =>
        item.alunoId === alunoId &&
        item.status === 'final' &&
        item.respondidoEm !== null &&
        (filtros.tipo === undefined || item.tipo === filtros.tipo) &&
        (filtros.modeloId === undefined || item.modeloId === filtros.modeloId) &&
        dentroDoPeriodo(item.respondidoEm, filtros.de, filtros.ate),
    );

    const sinal = filtros.sort.direction === 'asc' ? 1 : -1;
    encontradas.sort(
      (a, b) =>
        // Desempate pelo id: a ordem fica estável entre páginas.
        sinal * (a.respondidoEm.getTime() - b.respondidoEm.getTime()) || a.id.localeCompare(b.id),
    );

    return {
      items: encontradas
        .slice(filtros.skip, filtros.skip + filtros.take)
        .map((item) => structuredClone(item)),
      total: encontradas.length,
    };
  }
}

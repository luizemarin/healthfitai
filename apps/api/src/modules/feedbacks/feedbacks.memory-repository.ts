import { randomUUID } from 'node:crypto';

import { dataDoLembrete } from './feedbacks.agenda';
import { StatusFeedbackAlteradoError } from './feedbacks.repository';

import type {
  AgendamentoFeedback,
  AlteracoesAgendamento,
  ComentarioFeedback,
  EnvioFeedback,
  FeedbacksRepository,
  FiltrosListagemAgendamentos,
  FiltrosListagemEnvios,
  MudancaStatus,
  NovoAgendamento,
  NovoComentario,
  PaginaAgendamentos,
  PaginaEnvios,
  StatusFeedback,
} from './feedbacks.repository';
import type { SortOrder } from '../../shared/http/pagination';

/** Linha de feedback_envios como fica guardada (os campos do agendamento vêm do "JOIN"). */
type EnvioGuardado = Omit<
  EnvioFeedback,
  'alunoId' | 'modeloId' | 'lembreteDias' | 'totalComentarios'
>;

/** Só os campos informados (`undefined` = não alterar). */
function semUndefined<T extends object>(objeto: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

/** Ordena por data (null por último) com desempate pelo id: ordem estável entre páginas. */
function ordenar<T extends { id: string }, F extends keyof T & string>(
  itens: T[],
  sort: SortOrder<F>,
): T[] {
  const sinal = sort.direction === 'asc' ? 1 : -1;
  const tempo = (item: T): number => {
    const valor = item[sort.field];
    return valor instanceof Date ? valor.getTime() : Number.POSITIVE_INFINITY;
  };
  return [...itens].sort((a, b) => sinal * (tempo(a) - tempo(b)) || a.id.localeCompare(b.id));
}

/**
 * Implementação em memória, PROVISÓRIA até as tabelas no banco.
 * Os dados somem ao reiniciar a API. Imita o banco: gera os UUIDs, faz o "JOIN"
 * envio → agendamento e só muda o status se ele ainda for o esperado.
 * Devolve sempre cópias (nunca a referência).
 *
 * Os feedbacks (envios) são criados pelo job de liberação (BE-FBK-02).
 */
export class InMemoryFeedbacksRepository implements FeedbacksRepository {
  private readonly agendamentos = new Map<string, AgendamentoFeedback>();

  private readonly envios = new Map<string, EnvioGuardado>();

  private readonly comentarios = new Map<string, ComentarioFeedback>();

  // ─── Agendamentos ─────────────────────────────────────────────────────────

  async createAgendamento(dados: NovoAgendamento): Promise<AgendamentoFeedback> {
    const agora = new Date();
    const agendamento: AgendamentoFeedback = {
      id: randomUUID(),
      ...dados,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    this.agendamentos.set(agendamento.id, agendamento);
    return structuredClone(agendamento);
  }

  async findAgendamento(alunoId: string, id: string): Promise<AgendamentoFeedback | null> {
    const agendamento = this.agendamentos.get(id);
    return agendamento?.alunoId === alunoId ? structuredClone(agendamento) : null;
  }

  async findAgendamentoAtivo(
    alunoId: string,
    modeloId: string,
  ): Promise<AgendamentoFeedback | null> {
    const encontrado = [...this.agendamentos.values()].find(
      (item) => item.alunoId === alunoId && item.modeloId === modeloId && item.ativo,
    );
    return encontrado ? structuredClone(encontrado) : null;
  }

  async updateAgendamento(
    alunoId: string,
    id: string,
    alteracoes: AlteracoesAgendamento,
  ): Promise<AgendamentoFeedback | null> {
    const agendamento = this.agendamentos.get(id);
    if (agendamento?.alunoId !== alunoId) {
      return null;
    }

    const atualizado: AgendamentoFeedback = {
      ...agendamento,
      ...semUndefined(alteracoes),
      atualizadoEm: new Date(),
    };
    this.agendamentos.set(id, atualizado);

    return structuredClone(atualizado);
  }

  async listAgendamentos(
    alunoId: string,
    filtros: FiltrosListagemAgendamentos,
  ): Promise<PaginaAgendamentos> {
    const encontrados = [...this.agendamentos.values()].filter(
      (item) =>
        item.alunoId === alunoId && (filtros.ativo === undefined || item.ativo === filtros.ativo),
    );

    return {
      items: ordenar(encontrados, filtros.sort)
        .slice(filtros.skip, filtros.skip + filtros.take)
        .map((item) => structuredClone(item)),
      total: encontrados.length,
    };
  }

  // ─── Feedbacks enviados ───────────────────────────────────────────────────

  async findEnvio(alunoId: string, id: string): Promise<EnvioFeedback | null> {
    const envio = await this.findEnvioPorId(id);
    return envio?.alunoId === alunoId ? envio : null;
  }

  async findEnvioPorId(id: string): Promise<EnvioFeedback | null> {
    const envio = this.envios.get(id);
    return envio ? this.comAgendamento(envio) : null;
  }

  async listEnvios(alunoId: string, filtros: FiltrosListagemEnvios): Promise<PaginaEnvios> {
    const encontrados = [...this.envios.values()]
      .map((envio) => this.comAgendamento(envio))
      .filter(
        (envio) =>
          envio.alunoId === alunoId &&
          (filtros.status === undefined || envio.status === filtros.status) &&
          (filtros.agendamentoId === undefined || envio.agendamentoId === filtros.agendamentoId),
      );

    return {
      items: ordenar(encontrados, filtros.sort).slice(filtros.skip, filtros.skip + filtros.take),
      total: encontrados.length,
    };
  }

  async mudarStatus(
    id: string,
    de: StatusFeedback,
    mudanca: MudancaStatus,
  ): Promise<EnvioFeedback | null> {
    const envio = this.envios.get(id);
    if (!envio) {
      return null;
    }
    if (envio.status !== de) {
      throw new StatusFeedbackAlteradoError(envio.status);
    }

    const { para, ...datas } = mudanca;
    const atualizado: EnvioGuardado = {
      ...envio,
      ...datas,
      status: para,
      atualizadoEm: new Date(),
    };
    this.envios.set(id, atualizado);

    return this.comAgendamento(atualizado);
  }

  async listLembretesVencidos(agora: Date): Promise<EnvioFeedback[]> {
    return [...this.envios.values()]
      .filter((envio) => this.agendamentos.get(envio.agendamentoId)?.ativo === true)
      .map((envio) => this.comAgendamento(envio))
      .filter(
        (envio) =>
          envio.status === 'enviado' &&
          envio.enviadoEm !== null &&
          envio.lembreteDias !== null &&
          dataDoLembrete(envio.enviadoEm, envio.lembreteDias).getTime() <= agora.getTime(),
      );
  }

  // ─── Comentários ──────────────────────────────────────────────────────────

  async createComentario(dados: NovoComentario): Promise<ComentarioFeedback> {
    const comentario: ComentarioFeedback = { id: randomUUID(), ...dados, criadoEm: new Date() };

    this.comentarios.set(comentario.id, comentario);
    return structuredClone(comentario);
  }

  async listComentarios(envioId: string): Promise<ComentarioFeedback[]> {
    return ordenar(
      [...this.comentarios.values()].filter((item) => item.envioId === envioId),
      { field: 'criadoEm', direction: 'asc' },
    ).map((item) => structuredClone(item));
  }

  // ─── Apoio ────────────────────────────────────────────────────────────────

  /** Imita o JOIN com feedback_agendamentos e o _count de comentários. */
  private comAgendamento(envio: EnvioGuardado): EnvioFeedback {
    const agendamento = this.agendamentos.get(envio.agendamentoId);
    if (!agendamento) {
      // A FK do banco não deixa isso acontecer.
      throw new Error(`Agendamento ${envio.agendamentoId} do feedback ${envio.id} não existe.`);
    }
    const totalComentarios = [...this.comentarios.values()].filter(
      (item) => item.envioId === envio.id,
    ).length;

    return structuredClone({
      ...envio,
      alunoId: agendamento.alunoId,
      modeloId: agendamento.modeloId,
      lembreteDias: agendamento.lembreteDias,
      totalComentarios,
    });
  }
}

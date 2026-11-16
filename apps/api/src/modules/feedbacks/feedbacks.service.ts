import {
  dataDoLembrete,
  diaDoMesEmBrasilia,
  maxLembreteDias,
  ULTIMO_DIA_MENSAL,
} from './feedbacks.agenda';
import { StatusFeedbackAlteradoError } from './feedbacks.repository';
import { podeMudarStatus } from './feedbacks.status';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type {
  AgendamentoFeedback,
  ComentarioFeedback,
  EnvioFeedback,
  FeedbacksRepository,
  MudancaStatus,
  Recorrencia,
  StatusFeedback,
} from './feedbacks.repository';
import type {
  AtivarAgendamentoBody,
  CriarAgendamentoBody,
  EditarAgendamentoBody,
  ListarAgendamentosQuery,
  ListarFeedbacksQuery,
} from './feedbacks.schemas';
import type { ErrorDetail } from '../../shared/errors/app-error';
import type { Paginated } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';
import type {
  ModeloQuestionario,
  QuestionariosRepository,
  TipoModelo,
} from '../questionarios/questionarios.repository';

const NOMES_STATUS: Record<StatusFeedback, string> = {
  agendado: 'agendado',
  enviado: 'enviado',
  respondido: 'respondido',
  atrasado: 'atrasado',
};

const NOMES_TIPO_MODELO: Record<TipoModelo, string> = {
  anamnese: 'anamnese',
  avaliacao: 'avaliação',
  feedback: 'feedback',
};

function formatarData(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: (acao: string) =>
    new AppError(409, 'ALUNO_INATIVO', `O aluno está inativo. Reative o aluno para ${acao}.`),
  modeloNaoEncontrado: () => AppError.notFound('Modelo de questionário não encontrado.'),
  modeloNaoEhFeedback: (tipo: TipoModelo) =>
    new AppError(
      400,
      'MODELO_NAO_E_FEEDBACK',
      `Este modelo é de ${NOMES_TIPO_MODELO[tipo]}. Escolha um modelo de questionário do tipo feedback.`,
    ),
  modeloInativo: () =>
    new AppError(
      409,
      'MODELO_INATIVO',
      'O modelo de feedback está inativo. Ative o modelo ou escolha outro.',
    ),
  agendamentoNaoEncontrado: () => AppError.notFound('Agendamento de feedback não encontrado.'),
  agendamentoDuplicado: () =>
    new AppError(
      409,
      'AGENDAMENTO_DUPLICADO',
      'O aluno já tem um agendamento ativo com este modelo de feedback. ' +
        'Edite o agendamento existente em vez de criar outro.',
    ),
  agendamentoInativo: () =>
    new AppError(
      409,
      'AGENDAMENTO_INATIVO',
      'O agendamento está desativado. Ative o agendamento antes de editar.',
    ),
  agendamentoJaAtivo: () =>
    new AppError(409, 'AGENDAMENTO_JA_ATIVO', 'O agendamento já está ativo.'),
  agendamentoJaInativo: () =>
    new AppError(409, 'AGENDAMENTO_JA_INATIVO', 'O agendamento já está desativado.'),
  agendaInvalida: (details: ErrorDetail[]) =>
    AppError.validation(details, 'Revise as datas do agendamento.'),
  feedbackNaoEncontrado: () => AppError.notFound('Feedback não encontrado.'),
  feedbackNaoRespondido: (status: StatusFeedback) =>
    new AppError(
      409,
      'FEEDBACK_NAO_RESPONDIDO',
      `Só é possível comentar depois que o aluno responder o feedback ` +
        `(situação atual: ${NOMES_STATUS[status]}).`,
    ),
  transicaoInvalida: (de: StatusFeedback, para: StatusFeedback) =>
    new AppError(
      409,
      'TRANSICAO_STATUS_INVALIDA',
      `O feedback não pode passar de "${NOMES_STATUS[de]}" para "${NOMES_STATUS[para]}".`,
    ),
  statusAlterado: (atual: StatusFeedback) =>
    new AppError(
      409,
      'FEEDBACK_STATUS_ALTERADO',
      `A situação do feedback mudou para "${NOMES_STATUS[atual]}" enquanto a operação ` +
        'acontecia. Atualize a tela e tente de novo.',
    ),
  dataAnteriorAoEnvio: () =>
    new AppError(
      400,
      'DATA_ANTERIOR_AO_ENVIO',
      'A data informada é anterior ao envio do feedback.',
    ),
};

/** Folga para diferença de relógio entre o aparelho e o servidor. */
const TOLERANCIA_PASSADO_MS = 5 * 60 * 1000;

/** O que define "quando" um agendamento libera e lembra. */
interface Agenda {
  recorrencia: Recorrencia;
  proximaLiberacao: Date;
  lembreteDias: number | null;
}

/**
 * BE-FBK-01/03 · Regras que cruzam campos. Mesma função na criação, edição e
 * reativação, com o nome do campo que o front enviou em `campoData`.
 * Junta todos os problemas num único erro 400 (details por campo).
 */
function validarAgenda(agenda: Agenda, campoData: string, checarPassado: boolean): void {
  const details: ErrorDetail[] = [];
  const field = `body.${campoData}`;

  if (checarPassado && agenda.proximaLiberacao.getTime() < Date.now() - TOLERANCIA_PASSADO_MS) {
    details.push({ field, message: 'A data da liberação não pode estar no passado.' });
  }

  if (
    agenda.recorrencia === 'mensal' &&
    diaDoMesEmBrasilia(agenda.proximaLiberacao) > ULTIMO_DIA_MENSAL
  ) {
    details.push({
      field,
      message:
        `Na recorrência mensal, escolha um dia de 1 a ${ULTIMO_DIA_MENSAL} ` +
        '(nem todo mês tem 29, 30 ou 31 dias).',
    });
  }

  const maximo = maxLembreteDias(agenda.recorrencia);
  if (agenda.lembreteDias !== null && agenda.lembreteDias > maximo) {
    details.push({
      field: 'body.lembreteDias',
      message:
        `Com recorrência ${agenda.recorrencia}, o lembrete deve ser de no máximo ${maximo} ` +
        'dia(s), para sair antes do próximo feedback.',
    });
  }

  if (details.length > 0) {
    throw Erros.agendaInvalida(details);
  }
}

/** Data do fato que a transição registra (envio, lembrete ou resposta). */
function dataDoFato(mudanca: MudancaStatus): Date {
  switch (mudanca.para) {
    case 'enviado':
      return mudanca.enviadoEm;
    case 'atrasado':
      return mudanca.lembreteEm;
    default:
      return mudanca.respondidoEm;
  }
}

/** Não deveria acontecer: modelos nunca são apagados. Vira 500 e vai para o log. */
function semModelo(modeloId: string): never {
  throw new Error(`Modelo ${modeloId} de um agendamento de feedback não foi encontrado.`);
}

export type ModeloResumo = Pick<ModeloQuestionario, 'id' | 'nome'>;

export interface AgendamentoComModelo {
  agendamento: AgendamentoFeedback;
  modelo: ModeloResumo;
}

export interface FeedbackComModelo {
  envio: EnvioFeedback;
  modelo: ModeloResumo;
}

export interface FeedbackDetalhado extends FeedbackComModelo {
  comentarios: ComentarioFeedback[];
}

/** BE-FBK-03 · Quando sai o lembrete; só enquanto o feedback espera resposta. */
export function lembretePrevisto(envio: EnvioFeedback): Date | null {
  if (envio.status !== 'enviado' || envio.enviadoEm === null || envio.lembreteDias === null) {
    return null;
  }
  return dataDoLembrete(envio.enviadoEm, envio.lembreteDias);
}

/**
 * Feedbacks recorrentes do aluno.
 *   BE-FBK-01 · agendamento semanal, quinzenal, mensal ou avulso, por aluno e modelo
 *   BE-FBK-03 · lembrete configurável quando o aluno não responde
 *   BE-FBK-04 · máquina de status com transições validadas
 *   BE-FBK-05 · comentários do profissional, visíveis ao aluno
 * Não conhece HTTP/Express.
 */
export class FeedbacksService {
  private readonly repository: FeedbacksRepository;

  private readonly questionarios: QuestionariosRepository;

  private readonly alunos: AlunosRepository;

  constructor(
    repository: FeedbacksRepository,
    questionarios: QuestionariosRepository,
    alunos: AlunosRepository,
  ) {
    this.repository = repository;
    this.questionarios = questionarios;
    this.alunos = alunos;
  }

  // ─── BE-FBK-01 / BE-FBK-03 · Agendamentos ─────────────────────────────────

  async criarAgendamento(
    profissionalId: string,
    alunoId: string,
    dados: CriarAgendamentoBody,
  ): Promise<AgendamentoComModelo> {
    await this.buscarAlunoAtivo(profissionalId, alunoId, 'agendar feedbacks');
    const modelo = await this.buscarModeloDeFeedback(profissionalId, dados.modeloId);

    const agenda: Agenda = {
      recorrencia: dados.recorrencia,
      proximaLiberacao: new Date(dados.primeiraLiberacao),
      lembreteDias: dados.lembreteDias,
    };
    validarAgenda(agenda, 'primeiraLiberacao', true);

    await this.garantirSemDuplicado(alunoId, modelo.id);

    const agendamento = await this.repository.createAgendamento({
      alunoId,
      modeloId: modelo.id,
      ...agenda,
    });
    return { agendamento, modelo: { id: modelo.id, nome: modelo.nome } };
  }

  /** Aluno inativo continua consultável. */
  async listarAgendamentos(
    profissionalId: string,
    alunoId: string,
    query: ListarAgendamentosQuery,
  ): Promise<Paginated<AgendamentoComModelo>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.listAgendamentos(alunoId, {
      ativo: query.ativo,
      sort: query.sort,
      ...toSkipTake(query),
    });

    const modelos = await this.modelosPorId(profissionalId, items);
    const data = items.map((agendamento) => ({
      agendamento,
      modelo: modelos.get(agendamento.modeloId) ?? semModelo(agendamento.modeloId),
    }));
    return paginate(data, total, query);
  }

  async buscarAgendamento(
    profissionalId: string,
    alunoId: string,
    id: string,
  ): Promise<AgendamentoComModelo> {
    await this.buscarAluno(profissionalId, alunoId);
    return this.comModelo(profissionalId, await this.buscarAgendamentoDoAluno(alunoId, id));
  }

  /**
   * Edição parcial. Vale para os próximos feedbacks; os já enviados não mudam,
   * exceto o lembrete: o prazo novo vale também para quem ainda não respondeu.
   */
  async editarAgendamento(
    profissionalId: string,
    alunoId: string,
    id: string,
    dados: EditarAgendamentoBody,
  ): Promise<AgendamentoComModelo> {
    await this.buscarAlunoAtivo(profissionalId, alunoId, 'editar o agendamento');
    const atual = await this.buscarAgendamentoDoAluno(alunoId, id);
    if (!atual.ativo) {
      throw Erros.agendamentoInativo();
    }

    validarAgenda(
      {
        recorrencia: dados.recorrencia ?? atual.recorrencia,
        proximaLiberacao: dados.proximaLiberacao
          ? new Date(dados.proximaLiberacao)
          : atual.proximaLiberacao,
        lembreteDias: dados.lembreteDias === undefined ? atual.lembreteDias : dados.lembreteDias,
      },
      'proximaLiberacao',
      dados.proximaLiberacao !== undefined,
    );

    const atualizado = await this.repository.updateAgendamento(alunoId, id, {
      recorrencia: dados.recorrencia,
      proximaLiberacao: dados.proximaLiberacao ? new Date(dados.proximaLiberacao) : undefined,
      lembreteDias: dados.lembreteDias,
    });
    if (!atualizado) {
      throw Erros.agendamentoNaoEncontrado();
    }
    return this.comModelo(profissionalId, atualizado);
  }

  /** Para de liberar feedbacks. Não apaga: os feedbacks antigos continuam no histórico. */
  async desativarAgendamento(
    profissionalId: string,
    alunoId: string,
    id: string,
  ): Promise<AgendamentoComModelo> {
    await this.buscarAluno(profissionalId, alunoId);
    const atual = await this.buscarAgendamentoDoAluno(alunoId, id);
    if (!atual.ativo) {
      throw Erros.agendamentoJaInativo();
    }
    return this.salvarAtivo(profissionalId, alunoId, id, { ativo: false });
  }

  /**
   * Volta a liberar feedbacks. Se a próxima liberação salva já passou, o
   * profissional precisa informar uma nova (senão o job liberaria na hora).
   */
  async ativarAgendamento(
    profissionalId: string,
    alunoId: string,
    id: string,
    dados: AtivarAgendamentoBody,
  ): Promise<AgendamentoComModelo> {
    await this.buscarAlunoAtivo(profissionalId, alunoId, 'ativar o agendamento');
    const atual = await this.buscarAgendamentoDoAluno(alunoId, id);
    if (atual.ativo) {
      throw Erros.agendamentoJaAtivo();
    }
    await this.buscarModeloDeFeedback(profissionalId, atual.modeloId);

    const informada = dados?.proximaLiberacao;
    if (!informada && atual.proximaLiberacao.getTime() < Date.now()) {
      throw Erros.agendaInvalida([
        {
          field: 'body.proximaLiberacao',
          message:
            `A próxima liberação salva (${formatarData(atual.proximaLiberacao)}) já passou. ` +
            'Informe "proximaLiberacao" para reativar.',
        },
      ]);
    }
    const proximaLiberacao = informada ? new Date(informada) : atual.proximaLiberacao;
    validarAgenda({ ...atual, proximaLiberacao }, 'proximaLiberacao', true);

    await this.garantirSemDuplicado(alunoId, atual.modeloId);

    return this.salvarAtivo(profissionalId, alunoId, id, { ativo: true, proximaLiberacao });
  }

  // ─── BE-FBK-04 · Feedbacks e status ───────────────────────────────────────

  /** Feedbacks do aluno, filtráveis por status. Aluno inativo continua consultável. */
  async listarFeedbacks(
    profissionalId: string,
    alunoId: string,
    query: ListarFeedbacksQuery,
  ): Promise<Paginated<FeedbackComModelo>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.listEnvios(alunoId, {
      status: query.status,
      agendamentoId: query.agendamentoId,
      sort: query.sort,
      ...toSkipTake(query),
    });

    const modelos = await this.modelosPorId(profissionalId, items);
    const data = items.map((envio) => ({
      envio,
      modelo: modelos.get(envio.modeloId) ?? semModelo(envio.modeloId),
    }));
    return paginate(data, total, query);
  }

  /** Detalhe com os comentários do profissional (BE-FBK-05). */
  async buscarFeedback(
    profissionalId: string,
    alunoId: string,
    id: string,
  ): Promise<FeedbackDetalhado> {
    await this.buscarAluno(profissionalId, alunoId);
    const envio = await this.buscarEnvioDoAluno(alunoId, id);

    const [modelo, comentarios] = await Promise.all([
      this.modeloResumo(profissionalId, envio.modeloId),
      this.repository.listComentarios(envio.id),
    ]);
    return { envio, modelo, comentarios };
  }

  /**
   * Uso interno do job de liberação (BE-FBK-02): o e-mail com o link saiu.
   * agendado → enviado.
   */
  async marcarEnviado(envioId: string, enviadoEm: Date): Promise<EnvioFeedback> {
    return this.mudarStatus(envioId, { para: 'enviado', enviadoEm });
  }

  /**
   * Uso interno do fluxo de resposta: o aluno enviou as respostas.
   * enviado/atrasado → respondido (responder atrasado é permitido).
   */
  async marcarRespondido(
    envioId: string,
    submissaoId: string,
    respondidoEm: Date,
  ): Promise<EnvioFeedback> {
    return this.mudarStatus(envioId, { para: 'respondido', respondidoEm, submissaoId });
  }

  /**
   * BE-FBK-03 · Uso interno do job: marca como atrasado cada feedback cujo prazo
   * de lembrete venceu e devolve a lista para quem dispara o e-mail de
   * lembrete (BE-NOT-01). Feedback respondido no meio do caminho é ignorado.
   */
  async processarLembretes(agora: Date): Promise<EnvioFeedback[]> {
    const vencidos = await this.repository.listLembretesVencidos(agora);

    // Cada um é independente: um erro não impede os demais.
    const resultados = await Promise.allSettled(
      vencidos.map(async (envio) =>
        this.mudarStatus(envio.id, { para: 'atrasado', lembreteEm: agora }),
      ),
    );

    return resultados.flatMap((resultado, indice) => {
      if (resultado.status === 'fulfilled') {
        return [resultado.value];
      }
      const erro: unknown = resultado.reason;
      const corrida = erro instanceof AppError && erro.code === 'FEEDBACK_STATUS_ALTERADO';
      if (!corrida) {
        const detalhe = erro instanceof Error ? erro.message : String(erro);
        process.stderr.write(`[lembrete] feedback ${vencidos[indice]?.id ?? '?'}: ${detalhe}\n`);
      }
      return [];
    });
  }

  // ─── BE-FBK-05 · Comentários ──────────────────────────────────────────────

  /** Comentário do profissional, visível ao aluno. Só depois da resposta. */
  async comentar(
    profissionalId: string,
    alunoId: string,
    envioId: string,
    texto: string,
  ): Promise<ComentarioFeedback> {
    await this.buscarAlunoAtivo(profissionalId, alunoId, 'comentar o feedback');
    const envio = await this.buscarEnvioDoAluno(alunoId, envioId);
    if (envio.status !== 'respondido') {
      throw Erros.feedbackNaoRespondido(envio.status);
    }

    return this.repository.createComentario({ envioId: envio.id, profissionalId, texto });
  }

  // ─── Apoio ────────────────────────────────────────────────────────────────

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async buscarAlunoAtivo(
    profissionalId: string,
    alunoId: string,
    acao: string,
  ): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo(acao);
    }
    return aluno;
  }

  /** Modelo que o profissional enxerga, do tipo feedback e ativo. */
  private async buscarModeloDeFeedback(
    profissionalId: string,
    modeloId: string,
  ): Promise<ModeloQuestionario> {
    const modelo = await this.questionarios.findById(profissionalId, modeloId);
    if (!modelo) {
      throw Erros.modeloNaoEncontrado();
    }
    if (modelo.tipo !== 'feedback') {
      throw Erros.modeloNaoEhFeedback(modelo.tipo);
    }
    if (!modelo.ativo) {
      throw Erros.modeloInativo();
    }
    return modelo;
  }

  private async garantirSemDuplicado(alunoId: string, modeloId: string): Promise<void> {
    if (await this.repository.findAgendamentoAtivo(alunoId, modeloId)) {
      throw Erros.agendamentoDuplicado();
    }
  }

  private async buscarAgendamentoDoAluno(
    alunoId: string,
    id: string,
  ): Promise<AgendamentoFeedback> {
    const agendamento = await this.repository.findAgendamento(alunoId, id);
    if (!agendamento) {
      throw Erros.agendamentoNaoEncontrado();
    }
    return agendamento;
  }

  private async salvarAtivo(
    profissionalId: string,
    alunoId: string,
    id: string,
    alteracoes: { ativo: boolean; proximaLiberacao?: Date },
  ): Promise<AgendamentoComModelo> {
    const atualizado = await this.repository.updateAgendamento(alunoId, id, alteracoes);
    if (!atualizado) {
      throw Erros.agendamentoNaoEncontrado();
    }
    return this.comModelo(profissionalId, atualizado);
  }

  private async buscarEnvioDoAluno(alunoId: string, id: string): Promise<EnvioFeedback> {
    const envio = await this.repository.findEnvio(alunoId, id);
    if (!envio) {
      throw Erros.feedbackNaoEncontrado();
    }
    return envio;
  }

  /**
   * BE-FBK-04 · Única porta para mudar o status: confere a transição na
   * máquina, a ordem das datas, e grava só se ninguém mudou o status antes.
   */
  private async mudarStatus(envioId: string, mudanca: MudancaStatus): Promise<EnvioFeedback> {
    const envio = await this.repository.findEnvioPorId(envioId);
    if (!envio) {
      throw Erros.feedbackNaoEncontrado();
    }
    if (!podeMudarStatus(envio.status, mudanca.para)) {
      throw Erros.transicaoInvalida(envio.status, mudanca.para);
    }
    const data = dataDoFato(mudanca);
    if (mudanca.para !== 'enviado' && envio.enviadoEm && data < envio.enviadoEm) {
      throw Erros.dataAnteriorAoEnvio();
    }

    let atualizado: EnvioFeedback | null;
    try {
      atualizado = await this.repository.mudarStatus(envio.id, envio.status, mudanca);
    } catch (error) {
      if (error instanceof StatusFeedbackAlteradoError) {
        throw Erros.statusAlterado(error.statusAtual);
      }
      throw error;
    }
    if (!atualizado) {
      throw Erros.feedbackNaoEncontrado();
    }
    return atualizado;
  }

  private async comModelo(
    profissionalId: string,
    agendamento: AgendamentoFeedback,
  ): Promise<AgendamentoComModelo> {
    return { agendamento, modelo: await this.modeloResumo(profissionalId, agendamento.modeloId) };
  }

  private async modeloResumo(profissionalId: string, modeloId: string): Promise<ModeloResumo> {
    const modelo = await this.questionarios.findById(profissionalId, modeloId);
    return modelo ? { id: modelo.id, nome: modelo.nome } : semModelo(modeloId);
  }

  /** Um modelo por id distinto da página (com o Prisma vira JOIN). */
  private async modelosPorId(
    profissionalId: string,
    itens: { modeloId: string }[],
  ): Promise<Map<string, ModeloResumo>> {
    const ids = [...new Set(itens.map((item) => item.modeloId))];
    return new Map(
      await Promise.all(
        ids.map(async (id) => [id, await this.modeloResumo(profissionalId, id)] as const),
      ),
    );
  }
}

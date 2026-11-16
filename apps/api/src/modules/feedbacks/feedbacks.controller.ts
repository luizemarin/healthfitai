import {
  agendamentoParamsSchema,
  alunoParamsSchema,
  ativarAgendamentoBodySchema,
  criarAgendamentoBodySchema,
  criarComentarioBodySchema,
  editarAgendamentoBodySchema,
  feedbackParamsSchema,
  listarAgendamentosQuerySchema,
  listarFeedbacksQuerySchema,
} from './feedbacks.schemas';
import { lembretePrevisto } from './feedbacks.service';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { ComentarioFeedback } from './feedbacks.repository';
import type {
  AgendamentoResponse,
  ComentarioResponse,
  FeedbackResponse,
  FeedbackResumoResponse,
} from './feedbacks.schemas';
import type {
  AgendamentoComModelo,
  FeedbackComModelo,
  FeedbackDetalhado,
  FeedbacksService,
} from './feedbacks.service';

function toAgendamentoResponse({ agendamento, modelo }: AgendamentoComModelo): AgendamentoResponse {
  return {
    id: agendamento.id,
    alunoId: agendamento.alunoId,
    modelo,
    recorrencia: agendamento.recorrencia,
    proximaLiberacao: agendamento.proximaLiberacao.toISOString(),
    lembreteDias: agendamento.lembreteDias,
    ativo: agendamento.ativo,
    criadoEm: agendamento.criadoEm.toISOString(),
    atualizadoEm: agendamento.atualizadoEm.toISOString(),
  };
}

function toComentarioResponse(comentario: ComentarioFeedback): ComentarioResponse {
  return {
    id: comentario.id,
    texto: comentario.texto,
    criadoEm: comentario.criadoEm.toISOString(),
  };
}

function camposFeedback({ envio, modelo }: FeedbackComModelo) {
  return {
    id: envio.id,
    agendamentoId: envio.agendamentoId,
    alunoId: envio.alunoId,
    modelo,
    status: envio.status,
    submissaoId: envio.submissaoId,
    enviadoEm: envio.enviadoEm?.toISOString() ?? null,
    lembretePrevistoEm: lembretePrevisto(envio)?.toISOString() ?? null,
    lembreteEm: envio.lembreteEm?.toISOString() ?? null,
    respondidoEm: envio.respondidoEm?.toISOString() ?? null,
    criadoEm: envio.criadoEm.toISOString(),
    atualizadoEm: envio.atualizadoEm.toISOString(),
  };
}

function toFeedbackResumoResponse(item: FeedbackComModelo): FeedbackResumoResponse {
  return { ...camposFeedback(item), totalComentarios: item.envio.totalComentarios };
}

function toFeedbackResponse(detalhe: FeedbackDetalhado): FeedbackResponse {
  return {
    ...camposFeedback(detalhe),
    comentarios: detalhe.comentarios.map(toComentarioResponse),
  };
}

/**
 * HTTP dos feedbacks: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class FeedbacksController {
  private readonly service: FeedbacksService;

  constructor(service: FeedbacksService) {
    this.service = service;
  }

  // ─── BE-FBK-01 / BE-FBK-03 · Agendamentos ─────────────────────────────────

  criarAgendamento: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: criarAgendamentoBodySchema,
    });

    const criado = await this.service.criarAgendamento(profissionalId, params.alunoId, body);

    response
      .status(201)
      .location(`/alunos/${params.alunoId}/feedback-agendamentos/${criado.agendamento.id}`)
      .json(toAgendamentoResponse(criado));
  };

  listarAgendamentos: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarAgendamentosQuerySchema,
    });

    const { data, meta } = await this.service.listarAgendamentos(
      profissionalId,
      params.alunoId,
      query,
    );

    response.json({ data: data.map(toAgendamentoResponse), meta });
  };

  buscarAgendamento: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: agendamentoParamsSchema });

    const agendamento = await this.service.buscarAgendamento(
      profissionalId,
      params.alunoId,
      params.id,
    );

    response.json(toAgendamentoResponse(agendamento));
  };

  editarAgendamento: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: agendamentoParamsSchema,
      body: editarAgendamentoBodySchema,
    });

    const agendamento = await this.service.editarAgendamento(
      profissionalId,
      params.alunoId,
      params.id,
      body,
    );

    response.json(toAgendamentoResponse(agendamento));
  };

  desativarAgendamento: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: agendamentoParamsSchema });

    const agendamento = await this.service.desativarAgendamento(
      profissionalId,
      params.alunoId,
      params.id,
    );

    response.status(201).json(toAgendamentoResponse(agendamento));
  };

  ativarAgendamento: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: agendamentoParamsSchema,
      body: ativarAgendamentoBodySchema,
    });

    const agendamento = await this.service.ativarAgendamento(
      profissionalId,
      params.alunoId,
      params.id,
      body,
    );

    response.status(201).json(toAgendamentoResponse(agendamento));
  };

  // ─── BE-FBK-04 · Feedbacks e status ───────────────────────────────────────

  listarFeedbacks: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarFeedbacksQuerySchema,
    });

    const { data, meta } = await this.service.listarFeedbacks(
      profissionalId,
      params.alunoId,
      query,
    );

    response.json({ data: data.map(toFeedbackResumoResponse), meta });
  };

  buscarFeedback: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: feedbackParamsSchema });

    const detalhe = await this.service.buscarFeedback(profissionalId, params.alunoId, params.id);

    response.json(toFeedbackResponse(detalhe));
  };

  // ─── BE-FBK-05 · Comentários ──────────────────────────────────────────────

  comentar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: feedbackParamsSchema,
      body: criarComentarioBodySchema,
    });

    const comentario = await this.service.comentar(
      profissionalId,
      params.alunoId,
      params.id,
      body.texto,
    );

    response.status(201).json(toComentarioResponse(comentario));
  };
}

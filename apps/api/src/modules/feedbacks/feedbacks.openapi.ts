import {
  agendamentoParamsSchema,
  agendamentoResponseSchema,
  alunoParamsSchema,
  ativarAgendamentoBodySchema,
  comentarioResponseSchema,
  criarAgendamentoBodySchema,
  criarComentarioBodySchema,
  editarAgendamentoBodySchema,
  feedbackParamsSchema,
  feedbackResponseSchema,
  listaAgendamentosResponseSchema,
  listaFeedbacksResponseSchema,
  listarAgendamentosQuerySchema,
  listarFeedbacksQuerySchema,
} from './feedbacks.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Feedbacks'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const REGRAS_AGENDA = `Regras (400 VALIDATION_ERROR, com details por campo): a data não pode estar no passado; na recorrência mensal o dia deve ser de 1 a 28 (horário de Brasília); o lembrete deve sair antes do próximo feedback (semanal ≤ 6 dias, quinzenal ≤ 13, mensal ≤ 27, avulso ≤ 30).`;

const ERROS_MODELO = `404 NOT_FOUND (aluno ou modelo); 400 MODELO_NAO_E_FEEDBACK; 409 MODELO_INATIVO; 409 ALUNO_INATIVO; 409 AGENDAMENTO_DUPLICADO (já existe agendamento ativo do mesmo modelo para o aluno).`;

const STATUS = `Status (BE-FBK-04): agendado → enviado → respondido, ou enviado → atrasado (lembrete saiu sem resposta) → respondido.`;

/** Contrato das rotas de feedbacks (BE-FBK-01, 03, 04 e 05). */
export function registerFeedbacksOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/feedback-agendamentos',
    tags: TAGS,
    summary: 'Agendar feedback',
    description: `BE-FBK-01 · Programa o envio de um questionário de feedback para o aluno: semanal, quinzenal, mensal ou avulso (uma vez só). BE-FBK-03 · "lembreteDias" (opcional) reenvia o aviso se o aluno não responder nesse prazo. ${REGRAS_AGENDA} ${ERROS_MODELO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(criarAgendamentoBodySchema) },
    },
    responses: {
      201: { description: 'Agendamento criado.', content: json(agendamentoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/feedback-agendamentos',
    tags: TAGS,
    summary: 'Listar agendamentos do aluno',
    description:
      'BE-FBK-01 · Padrão: próxima liberação mais cedo primeiro. Aluno inativo continua consultável. 404 NOT_FOUND se o aluno não existe.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarAgendamentosQuerySchema,
    },
    responses: {
      200: {
        description: 'Página de agendamentos.',
        content: json(listaAgendamentosResponseSchema),
      },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/feedback-agendamentos/{id}',
    tags: TAGS,
    summary: 'Detalhar agendamento',
    description: '404 NOT_FOUND (aluno ou agendamento).',
    request: { headers: profissionalHeaderSchema, params: agendamentoParamsSchema },
    responses: {
      200: { description: 'Agendamento.', content: json(agendamentoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/alunos/{alunoId}/feedback-agendamentos/{id}',
    tags: TAGS,
    summary: 'Editar agendamento',
    description: `BE-FBK-01/03 · Só os campos enviados mudam (lembreteDias: null remove o lembrete). Vale para os próximos feedbacks; o prazo do lembrete vale também para os que ainda esperam resposta. O modelo não muda: desative e crie outro. ${REGRAS_AGENDA} 404 NOT_FOUND (aluno ou agendamento); 409 ALUNO_INATIVO; 409 AGENDAMENTO_INATIVO.`,
    request: {
      headers: profissionalHeaderSchema,
      params: agendamentoParamsSchema,
      body: { required: true, content: json(editarAgendamentoBodySchema) },
    },
    responses: {
      200: { description: 'Agendamento alterado.', content: json(agendamentoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/feedback-agendamentos/{id}/desativar',
    tags: TAGS,
    summary: 'Desativar agendamento',
    description:
      'Para de liberar feedbacks e de mandar lembretes. Nada é apagado: os feedbacks já enviados continuam no histórico. 404 NOT_FOUND; 409 AGENDAMENTO_JA_INATIVO.',
    request: { headers: profissionalHeaderSchema, params: agendamentoParamsSchema },
    responses: {
      201: { description: 'Agendamento desativado.', content: json(agendamentoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/feedback-agendamentos/{id}/ativar',
    tags: TAGS,
    summary: 'Reativar agendamento',
    description: `Volta a liberar feedbacks. "proximaLiberacao" é obrigatória quando a data salva já passou. ${REGRAS_AGENDA} ${ERROS_MODELO} 409 AGENDAMENTO_JA_ATIVO.`,
    request: {
      headers: profissionalHeaderSchema,
      params: agendamentoParamsSchema,
      body: { required: false, content: json(ativarAgendamentoBodySchema) },
    },
    responses: {
      201: { description: 'Agendamento reativado.', content: json(agendamentoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/feedbacks',
    tags: TAGS,
    summary: 'Feedbacks do aluno',
    description: `BE-FBK-04 · Cada liberação de um agendamento, filtrável por status. ${STATUS} Padrão: mais recentes primeiro. 404 NOT_FOUND se o aluno não existe.`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarFeedbacksQuerySchema,
    },
    responses: {
      200: { description: 'Página de feedbacks.', content: json(listaFeedbacksResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/feedbacks/{id}',
    tags: TAGS,
    summary: 'Detalhar feedback',
    description: `Status, datas e comentários do profissional (do mais antigo ao mais novo). As respostas ficam em GET /alunos/{alunoId}/submissoes/{submissaoId}. ${STATUS} 404 NOT_FOUND (aluno ou feedback).`,
    request: { headers: profissionalHeaderSchema, params: feedbackParamsSchema },
    responses: {
      200: { description: 'Feedback.', content: json(feedbackResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/feedbacks/{id}/comentarios',
    tags: TAGS,
    summary: 'Comentar feedback',
    description:
      'BE-FBK-05 · Comentário do profissional, visível ao aluno. Só em feedback respondido. Nada é sobrescrito: para corrigir, escreva outro comentário. 404 NOT_FOUND (aluno ou feedback); 409 ALUNO_INATIVO; 409 FEEDBACK_NAO_RESPONDIDO.',
    request: {
      headers: profissionalHeaderSchema,
      params: feedbackParamsSchema,
      body: { required: true, content: json(criarComentarioBodySchema) },
    },
    responses: {
      201: { description: 'Comentário criado.', content: json(comentarioResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });
}

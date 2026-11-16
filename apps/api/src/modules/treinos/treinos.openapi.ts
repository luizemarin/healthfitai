import {
  alunoParamsSchema,
  criarTreinoBodySchema,
  duplicarTreinoBodySchema,
  editarTreinoBodySchema,
  execucaoIdParamsSchema,
  execucaoResponseSchema,
  finalizarExecucaoBodySchema,
  listarTreinosQuerySchema,
  listaTreinosResponseSchema,
  treinoIdParamsSchema,
  treinoParamsSchema,
  treinoResponseSchema,
} from './treinos.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Treinos'];
const TAGS_EXECUCAO = ['Treinos · Execução'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const EXERCICIOS =
  '404 EXERCICIO_NAO_ENCONTRADO: exercício que não está na sua biblioteca; 409 EXERCICIO_EXCLUIDO: exercício excluído da biblioteca (details apontam qual item).';
const ALUNO_INATIVO = '409 ALUNO_INATIVO: reative o aluno antes.';

/** Contrato das rotas de treinos (BE-TRE-01) e execução de treino (BE-TRE-02). */
export function registerTreinosOpenApi(registry: OpenAPIRegistry): void {
  // ─── BE-TRE-01 · Treinos ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/treinos',
    tags: TAGS,
    summary: 'Montar treino',
    description: `BE-TRE-01 · A ordem dos exercícios é a ordem da lista; cada exercício aparece uma vez. ${EXERCICIOS} ${ALUNO_INATIVO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(criarTreinoBodySchema) },
    },
    responses: {
      201: { description: 'Treino criado.', content: json(treinoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/treinos',
    tags: TAGS,
    summary: 'Listar treinos do aluno',
    description: 'BE-TRE-01 · Só os ativos (removidos não aparecem). "q" busca no nome.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarTreinosQuerySchema,
    },
    responses: {
      200: { description: 'Página de treinos.', content: json(listaTreinosResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/treinos/{id}',
    tags: TAGS,
    summary: 'Detalhar treino',
    description:
      'BE-TRE-01 · Exercícios na ordem, com séries, repetições, descanso e carga (o app usa o descanso no timer). 404 NOT_FOUND se não existir, for de aluno de outro profissional ou foi removido.',
    request: { headers: profissionalHeaderSchema, params: treinoIdParamsSchema },
    responses: {
      200: { description: 'Treino.', content: json(treinoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/treinos/{id}',
    tags: TAGS,
    summary: 'Editar treino',
    description: `BE-TRE-01 · Só os campos enviados mudam; "exercicios" substitui a lista inteira. O histórico de treinos feitos não muda. ${EXERCICIOS} ${ALUNO_INATIVO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: treinoIdParamsSchema,
      body: { required: true, content: json(editarTreinoBodySchema) },
    },
    responses: {
      200: { description: 'Treino alterado.', content: json(treinoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/treinos/{id}/duplicar',
    tags: TAGS,
    summary: 'Duplicar treino',
    description: `BE-TRE-01 · Novo treino com cópia dos exercícios (séries, repetições, descanso e carga), para o mesmo aluno ou outro. Corpo opcional. 409 TREINO_COM_EXERCICIO_EXCLUIDO: troque os exercícios excluídos antes de duplicar. ${ALUNO_INATIVO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: treinoIdParamsSchema,
      body: { required: false, content: json(duplicarTreinoBodySchema) },
    },
    responses: {
      201: { description: 'Cópia criada.', content: json(treinoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/treinos/{id}',
    tags: TAGS,
    summary: 'Remover treino',
    description:
      'BE-TRE-01 · O treino sai da lista do aluno, mas os treinos já feitos continuam no histórico (exclusão lógica). 404 NOT_FOUND se não existir ou já foi removido.',
    request: { headers: profissionalHeaderSchema, params: treinoIdParamsSchema },
    responses: {
      204: { description: 'Treino removido.' },
      ...errorResponses(400, 401, 404),
    },
  });

  // ─── BE-TRE-02 · Execução ─────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/treinos/{treinoId}/execucoes',
    tags: TAGS_EXECUCAO,
    summary: 'Finalizar treino (registrar execução)',
    description: [
      'BE-TRE-02 · O app envia tudo ao tocar em "Finalizar treino": início, duração e cada série feita (repetições, carga e descanso). Pode ser enviado depois (offline).',
      'Nada é sobrescrito: treinou de novo = nova execução.',
      '400 VALIDATION_ERROR: horário no futuro; 404 EXERCICIO_NAO_ENCONTRADO;',
      '409 EXECUCAO_JA_REGISTRADA: reenvio do mesmo treino (mesmo início), nada foi duplicado (o app pode tratar como enviado);',
      ALUNO_INATIVO,
    ].join(' '),
    request: {
      headers: profissionalHeaderSchema,
      params: treinoParamsSchema,
      body: { required: true, content: json(finalizarExecucaoBodySchema) },
    },
    responses: {
      201: { description: 'Treino registrado.', content: json(execucaoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/execucoes-treino/{id}',
    tags: TAGS_EXECUCAO,
    summary: 'Detalhar treino realizado',
    description:
      'BE-TRE-02 · Resumo de um treino feito: duração e séries com carga, repetições e descanso.',
    request: { headers: profissionalHeaderSchema, params: execucaoIdParamsSchema },
    responses: {
      200: { description: 'Treino realizado.', content: json(execucaoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });
}

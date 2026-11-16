import {
  criarExercicioBodySchema,
  editarExercicioBodySchema,
  exercicioIdParamsSchema,
  exercicioResponseSchema,
  listaExerciciosResponseSchema,
  listarExerciciosQuerySchema,
} from './exercicios.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Exercícios'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const DUPLICADO =
  '409 EXERCICIO_DUPLICADO: já existe um exercício com o mesmo nome na biblioteca (sem diferenciar maiúsculas/acentos).';

/** Contrato das rotas da biblioteca de exercícios (BE-EXE-01). */
export function registerExerciciosOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/exercicios',
    tags: TAGS,
    summary: 'Criar exercício',
    description: `BE-EXE-01 · Adiciona um exercício à biblioteca do profissional. ${DUPLICADO}`,
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(criarExercicioBodySchema) },
    },
    responses: {
      201: { description: 'Exercício criado.', content: json(exercicioResponseSchema) },
      ...errorResponses(400, 401, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/exercicios',
    tags: TAGS,
    summary: 'Listar exercícios',
    description:
      'BE-EXE-01 · Exercícios da biblioteca (excluídos não aparecem). "q" busca no nome e no grupo muscular.',
    request: { headers: profissionalHeaderSchema, query: listarExerciciosQuerySchema },
    responses: {
      200: { description: 'Página de exercícios.', content: json(listaExerciciosResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/exercicios/{id}',
    tags: TAGS,
    summary: 'Detalhar exercício',
    description:
      'BE-EXE-01 · 404 NOT_FOUND se não existir, for de outro profissional ou foi excluído.',
    request: { headers: profissionalHeaderSchema, params: exercicioIdParamsSchema },
    responses: {
      200: { description: 'Exercício.', content: json(exercicioResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/exercicios/{id}',
    tags: TAGS,
    summary: 'Editar exercício',
    description: `BE-EXE-01 · Só os campos enviados mudam; null limpa descrição/mídia. 404 NOT_FOUND; ${DUPLICADO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: exercicioIdParamsSchema,
      body: { required: true, content: json(editarExercicioBodySchema) },
    },
    responses: {
      200: { description: 'Exercício alterado.', content: json(exercicioResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/exercicios/{id}',
    tags: TAGS,
    summary: 'Excluir exercício',
    description:
      'BE-EXE-01 · O exercício sai da biblioteca, mas treinos e execuções que já o usam continuam íntegros (exclusão lógica). 404 NOT_FOUND se não existir ou já foi excluído.',
    request: { headers: profissionalHeaderSchema, params: exercicioIdParamsSchema },
    responses: {
      204: { description: 'Exercício excluído.' },
      ...errorResponses(400, 401, 404),
    },
  });
}

import {
  alunoIdParamsSchema,
  alunoResponseSchema,
  atualizarAlunoBodySchema,
  criarAlunoBodySchema,
  listaAlunosResponseSchema,
  listarAlunosQuerySchema,
  perfilAlunoResponseSchema,
} from './alunos.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Alunos'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

/** Contrato das rotas de alunos (BE-ALU-01, BE-ALU-02 e BE-ALU-03). */
export function registerAlunosOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/alunos',
    tags: TAGS,
    summary: 'Cadastrar aluno',
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(criarAlunoBodySchema) },
    },
    responses: {
      201: { description: 'Aluno cadastrado.', content: json(alunoResponseSchema) },
      ...errorResponses(400, 401, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos',
    tags: TAGS,
    summary: 'Listar alunos',
    description:
      'Busca por nome ou e-mail (q), filtros por situação e sexo, paginação e ordenação.',
    request: { headers: profissionalHeaderSchema, query: listarAlunosQuerySchema },
    responses: {
      200: { description: 'Página de alunos.', content: json(listaAlunosResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{id}',
    tags: TAGS,
    summary: 'Detalhar aluno',
    request: { headers: profissionalHeaderSchema, params: alunoIdParamsSchema },
    responses: {
      200: { description: 'Aluno.', content: json(alunoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/alunos/{id}',
    tags: TAGS,
    summary: 'Editar aluno',
    description: 'Envie só os campos que mudam. null em email/telefone remove o contato.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoIdParamsSchema,
      body: { required: true, content: json(atualizarAlunoBodySchema) },
    },
    responses: {
      200: { description: 'Aluno atualizado.', content: json(alunoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{id}/perfil',
    tags: TAGS,
    summary: 'Perfil do aluno',
    description: 'Dados básicos, sexo, data de nascimento (com idade calculada) e contato.',
    request: { headers: profissionalHeaderSchema, params: alunoIdParamsSchema },
    responses: {
      200: { description: 'Perfil do aluno.', content: json(perfilAlunoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{id}/desativar',
    tags: TAGS,
    summary: 'Desativar aluno',
    description:
      'Nada é apagado: o histórico continua guardado. O convite válido, se houver, é revogado. ' +
      '409 se o aluno já estiver inativo (ALUNO_JA_INATIVO).',
    request: { headers: profissionalHeaderSchema, params: alunoIdParamsSchema },
    responses: {
      200: { description: 'Aluno desativado.', content: json(alunoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{id}/ativar',
    tags: TAGS,
    summary: 'Ativar aluno',
    description: 'Reativa um aluno inativo. 409 se o aluno já estiver ativo (ALUNO_JA_ATIVO).',
    request: { headers: profissionalHeaderSchema, params: alunoIdParamsSchema },
    responses: {
      200: { description: 'Aluno ativado.', content: json(alunoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });
}

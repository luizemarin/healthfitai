import {
  conviteAlunoParamsSchema,
  conviteGeradoResponseSchema,
  listaConvitesResponseSchema,
} from './convites.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Convites'];

const request = { headers: profissionalHeaderSchema, params: conviteAlunoParamsSchema };

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

/** Contrato das rotas de convite (BE-ALU-04). */
export function registerConvitesOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/convites',
    tags: TAGS,
    summary: 'Listar convites do aluno',
    description:
      'Histórico do mais novo ao mais antigo, com status: valido, usado, revogado ou expirado.',
    request,
    responses: {
      200: { description: 'Convites do aluno.', content: json(listaConvitesResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/convites',
    tags: TAGS,
    summary: 'Gerar convite',
    description:
      'Gera o link único de ativação. O link só aparece nesta resposta. ' +
      '409 se o aluno estiver inativo (ALUNO_INATIVO) ou já tiver convite válido (CONVITE_JA_VALIDO).',
    request,
    responses: {
      201: { description: 'Convite gerado.', content: json(conviteGeradoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/convites/reenviar',
    tags: TAGS,
    summary: 'Reenviar convite',
    description:
      'Revoga o convite válido (se houver) e gera um novo link. O link anterior deixa de funcionar. ' +
      '409 se o aluno estiver inativo (ALUNO_INATIVO).',
    request,
    responses: {
      201: { description: 'Novo convite gerado.', content: json(conviteGeradoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/convites/revogar',
    tags: TAGS,
    summary: 'Revogar convite',
    description:
      'Revoga o convite válido; o link deixa de funcionar. ' +
      '409 se não houver convite válido (SEM_CONVITE_VALIDO).',
    request,
    responses: {
      204: { description: 'Convite revogado.' },
      ...errorResponses(400, 401, 404, 409),
    },
  });
}

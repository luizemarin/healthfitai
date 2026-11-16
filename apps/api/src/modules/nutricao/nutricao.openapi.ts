import {
  alunoParamsSchema,
  criarPlanoBodySchema,
  editarPlanoBodySchema,
  listaPlanosResponseSchema,
  listarPlanosQuerySchema,
  planoIdParamsSchema,
  planoResponseSchema,
} from './nutricao.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Nutrição'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const ALUNO_INATIVO = '409 ALUNO_INATIVO: reative o aluno antes.';
const PLANO_INATIVO =
  '409 PLANO_NUTRICIONAL_INATIVO: o plano já foi substituído ou encerrado (crie um novo).';

/** Contrato das rotas de planejamento nutricional (BE-NUT-01). */
export function registerNutricaoOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/planos-nutricionais',
    tags: TAGS,
    summary: 'Criar plano nutricional',
    description: `BE-NUT-01 · O novo plano passa a ser o plano em uso; o anterior vai para o histórico (nada é apagado). A ordem das refeições é a ordem da lista. ${ALUNO_INATIVO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(criarPlanoBodySchema) },
    },
    responses: {
      201: { description: 'Plano criado.', content: json(planoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/planos-nutricionais',
    tags: TAGS,
    summary: 'Histórico de planos do aluno',
    description:
      'BE-NUT-01 · Plano em uso e antigos (mais recente primeiro). "ativo" filtra; "q" busca no nome.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarPlanosQuerySchema,
    },
    responses: {
      200: { description: 'Página de planos.', content: json(listaPlanosResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/planos-nutricionais/ativo',
    tags: TAGS,
    summary: 'Plano nutricional em uso',
    description:
      'BE-NUT-01 · O plano que o aluno está seguindo agora. 404 PLANO_NUTRICIONAL_NAO_DEFINIDO: o aluno ainda não tem plano (o front mostra o estado vazio); 404 NOT_FOUND: aluno não encontrado.',
    request: { headers: profissionalHeaderSchema, params: alunoParamsSchema },
    responses: {
      200: { description: 'Plano em uso.', content: json(planoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/planos-nutricionais/{id}',
    tags: TAGS,
    summary: 'Detalhar plano nutricional',
    description:
      'BE-NUT-01 · Qualquer plano do histórico, com as refeições na ordem. 404 NOT_FOUND se não existir ou for de aluno de outro profissional.',
    request: { headers: profissionalHeaderSchema, params: planoIdParamsSchema },
    responses: {
      200: { description: 'Plano.', content: json(planoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/planos-nutricionais/{id}',
    tags: TAGS,
    summary: 'Editar plano nutricional em uso',
    description: `BE-NUT-01 · Só os campos enviados mudam; "refeicoes" substitui a lista inteira; "observacoes": null apaga a observação. ${PLANO_INATIVO} ${ALUNO_INATIVO}`,
    request: {
      headers: profissionalHeaderSchema,
      params: planoIdParamsSchema,
      body: { required: true, content: json(editarPlanoBodySchema) },
    },
    responses: {
      200: { description: 'Plano alterado.', content: json(planoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/planos-nutricionais/{id}',
    tags: TAGS,
    summary: 'Encerrar plano nutricional',
    description: `BE-NUT-01 · O aluno fica sem plano em uso; este continua no histórico (exclusão lógica). ${PLANO_INATIVO}`,
    request: { headers: profissionalHeaderSchema, params: planoIdParamsSchema },
    responses: {
      204: { description: 'Plano encerrado.' },
      ...errorResponses(400, 401, 404, 409),
    },
  });
}

import {
  alunoParamsSchema,
  dashboardAlunoResponseSchema,
  listaDashboardResponseSchema,
  listarDashboardQuerySchema,
  periodoQuerySchema,
} from './dashboard.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Dashboard'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const PERIODO =
  'Período em dias do horário de Brasília: sem filtro, últimos 30 dias; máximo 366. ' +
  '400 VALIDATION_ERROR: data inválida, no futuro, "de" depois de "ate" ou período longo demais (details aponta o campo).';

/** Contrato das rotas do painel (BE-DSH-01). */
export function registerDashboardOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/dashboard/alunos',
    tags: TAGS,
    summary: 'Visão consolidada dos alunos',
    description:
      'BE-DSH-01 · Frequência de treino de cada aluno no período: treinos, dias treinados, média semanal, último treino e dias sem treinar. ' +
      'Conta só treinos finalizados (BE-TRE-02). Padrão: só alunos ativos (ativo=false para ver os inativos). ' +
      `"q" busca no nome do aluno. ${PERIODO}`,
    request: { headers: profissionalHeaderSchema, query: listarDashboardQuerySchema },
    responses: {
      200: { description: 'Frequência por aluno.', content: json(listaDashboardResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/dashboard',
    tags: TAGS,
    summary: 'Frequência e progressão de carga do aluno',
    description:
      'BE-DSH-01 · Frequência do aluno com os treinos semana a semana (gráfico de barras) e a progressão de carga por exercício: maior carga de cada dia, carga inicial, atual e variação. ' +
      'Exercícios excluídos da biblioteca continuam aparecendo (ativo=false). Aluno inativo continua consultável. ' +
      `${PERIODO} 404 NOT_FOUND (aluno).`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: periodoQuerySchema,
    },
    responses: {
      200: {
        description: 'Frequência e progressão de carga.',
        content: json(dashboardAlunoResponseSchema),
      },
      ...errorResponses(400, 401, 404),
    },
  });
}

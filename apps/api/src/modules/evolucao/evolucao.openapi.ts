import { alunoParamsSchema, evolucaoQuerySchema, evolucaoResponseSchema } from './evolucao.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Evolução'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

/** Contrato da rota de evolução (BE-EVO-01). */
export function registerEvolucaoOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/evolucao',
    tags: TAGS,
    summary: 'Séries de evolução do aluno',
    description:
      'BE-EVO-01 · Tudo o que o gráfico de evolução precisa numa chamada: peso, medidas (uma série por tipo) e perguntas marcadas com "exibir no gráfico de evolução" (uma série por pergunta, só de questionários enviados). ' +
      'Pontos em ordem de data crescente, um por dia (no mesmo dia, vale o valor mais recente). ' +
      'A pergunta continua na mesma curva depois que o modelo ganha versão nova, desde que o enunciado e a unidade não mudem. ' +
      'Tipos de medida desativados continuam aparecendo. Aluno inativo continua consultável. 404 NOT_FOUND (aluno).',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: evolucaoQuerySchema,
    },
    responses: {
      200: { description: 'Séries de evolução.', content: json(evolucaoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });
}

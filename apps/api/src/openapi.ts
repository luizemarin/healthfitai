import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { registerAlunosOpenApi } from './modules/alunos/alunos.openapi';

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

type OpenApiRegistration = (registry: OpenAPIRegistry) => void;

/**
 * Registro único do contrato OpenAPI de cada módulo (par do routes.ts).
 *
 * Cada módulo documenta suas rotas em src/modules/<modulo>/<modulo>.openapi.ts,
 * exportando register<Modulo>OpenApi(registry), e entra nesta lista.
 * Os schemas Zod usados na validação são os mesmos do contrato (fonte única).
 * Schemas com .meta({ id }) (ex.: ErrorResponse, PaginationMeta) viram components/$ref
 * automaticamente quando referenciados por uma rota; respostas de erro via errorResponses(...).
 */
const registrations: readonly OpenApiRegistration[] = [registerAlunosOpenApi];

export function createOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  registrations.forEach((register) => {
    register(registry);
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'HealthFitAI API',
      version: '0.1.0',
      description: 'API do HealthFitAI (app do aluno e painel do profissional).',
    },
  });
}

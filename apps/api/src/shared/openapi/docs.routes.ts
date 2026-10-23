import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import type { OpenApiDocument } from '../../openapi';

/**
 * Expõe o contrato:
 *   GET /openapi.json → documento OpenAPI (base para testes de contrato e client tipado)
 *   GET /docs         → Swagger UI
 */
export function createDocsRouter(document: OpenApiDocument): Router {
  const router = Router();

  router.get('/openapi.json', (_request, response) => {
    response.json(document);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(document));

  return router;
}

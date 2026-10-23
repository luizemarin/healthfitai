import express from 'express';
import { z } from 'zod';
import { ptBR } from 'zod/locales';

import { createOpenApiDocument } from './openapi';
import { createRouter } from './routes';
import { errorHandler, notFoundHandler } from './shared/errors/error-handler';
import { createDocsRouter } from './shared/openapi/docs.routes';

import type { Express } from 'express';

// Mensagens de validação do Zod em português (vale para o processo todo, inclusive o env).
z.config(ptBR());

/** Monta o app Express sem abrir porta (o server.ts decide onde escutar). */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(createDocsRouter(createOpenApiDocument()));
  app.use(createRouter());

  // Sempre por último: 404 de rota inexistente e conversão de qualquer erro no payload único.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

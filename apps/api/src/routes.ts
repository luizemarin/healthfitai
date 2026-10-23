import { Router } from 'express';

import { createAlunosRouter } from './modules/alunos/alunos.routes';

/**
 * Registro único das rotas de cada módulo.
 *
 * Camadas (uma pasta por domínio em src/modules/<modulo>/):
 *   <modulo>.routes.ts      → rotas e composição das dependências do módulo
 *   <modulo>.controller.ts  → HTTP: lê a request, chama o serviço, monta a response
 *   <modulo>.service.ts     → regra de negócio, sem conhecer HTTP/Express
 *   <modulo>.repository.ts  → acesso a dados
 *   <modulo>.openapi.ts     → contrato das rotas (registrado em src/openapi.ts)
 * Dependência só para baixo: routes → controller → service → repository.
 * Código transversal (erros, middlewares etc.) fica em src/shared/.
 *
 * Padrões (src/shared/):
 *   Erros      → service lança AppError/NotFoundError/...; o errorHandler responde sempre
 *                { error: { code, message, details? } }. Nunca montar resposta de erro na mão.
 *   Validação  → controller chama validateRequest(request, { params, query, body }) com schemas Zod;
 *                os mesmos schemas entram no <modulo>.openapi.ts (+ errorResponses(...)).
 *   Listagens  → query com listQuerySchema(...) (page, pageSize, sort, q, filtros);
 *                resposta com paginate(...) → { data, meta }.
 */
export function createRouter(): Router {
  const router = Router();

  router.use(createAlunosRouter());

  return router;
}

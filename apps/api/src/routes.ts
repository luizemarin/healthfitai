import { Router } from 'express';

import { InMemoryAlunosRepository } from './modules/alunos/alunos.memory-repository';
import { createAlunosRouter } from './modules/alunos/alunos.routes';
import { InMemoryConvitesRepository } from './modules/convites/convites.memory-repository';
import { createConvitesRouter } from './modules/convites/convites.routes';
import { InMemoryQuestionariosRepository } from './modules/questionarios/questionarios.memory-repository';
import { createQuestionariosRouter } from './modules/questionarios/questionarios.routes';

import type { Env } from './config/env';

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
export function createRouter(env: Env): Router {
  // Repositórios criados uma vez e compartilhados entre os módulos (ex.: desativar
  // aluno revoga convites). PROVISÓRIO: em memória até o Prisma; troca só aqui.
  const alunos = new InMemoryAlunosRepository();
  const convites = new InMemoryConvitesRepository();
  const questionarios = new InMemoryQuestionariosRepository();

  const router = Router();

  router.use(createAlunosRouter(alunos, convites));
  router.use(
    createConvitesRouter(alunos, convites, {
      urlBase: env.CONVITE_URL_BASE,
      validadeHoras: env.CONVITE_VALIDADE_HORAS,
    }),
  );
  router.use(createQuestionariosRouter(questionarios));

  return router;
}

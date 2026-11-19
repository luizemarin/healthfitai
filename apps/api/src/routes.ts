import { Router } from 'express';

import { InMemoryAlunosRepository } from './modules/alunos/alunos.memory-repository';
import { createAlunosRouter } from './modules/alunos/alunos.routes';
import { InMemoryConvitesRepository } from './modules/convites/convites.memory-repository';
import { createConvitesRouter } from './modules/convites/convites.routes';
import { InMemoryDashboardRepository } from './modules/dashboard/dashboard.memory-repository';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes';
import { InMemoryEvolucaoRepository } from './modules/evolucao/evolucao.memory-repository';
import { createEvolucaoRouter } from './modules/evolucao/evolucao.routes';
import { InMemoryExerciciosRepository } from './modules/exercicios/exercicios.memory-repository';
import { createExerciciosRouter } from './modules/exercicios/exercicios.routes';
import { InMemoryFeedbacksRepository } from './modules/feedbacks/feedbacks.memory-repository';
import { createFeedbacksRouter } from './modules/feedbacks/feedbacks.routes';
import { FeedbacksService } from './modules/feedbacks/feedbacks.service';
import { InMemoryFotosRepository } from './modules/fotos/fotos.memory-repository';
import { createFotosRouter } from './modules/fotos/fotos.routes';
import { InMemoryMedidasRepository } from './modules/medidas/medidas.memory-repository';
import { createMedidasRouter } from './modules/medidas/medidas.routes';
import { InMemoryNutricaoRepository } from './modules/nutricao/nutricao.memory-repository';
import { createNutricaoRouter } from './modules/nutricao/nutricao.routes';
import { InMemoryQuestionariosRepository } from './modules/questionarios/questionarios.memory-repository';
import { createQuestionariosRouter } from './modules/questionarios/questionarios.routes';
import { InMemoryRespostasRepository } from './modules/respostas/respostas.memory-repository';
import { createRespostasRouter } from './modules/respostas/respostas.routes';
import { InMemoryTreinosRepository } from './modules/treinos/treinos.memory-repository';
import { createTreinosRouter } from './modules/treinos/treinos.routes';
import { createObjectStorage } from './shared/storage/s3-object-storage';

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
 *   Status     → GET/PUT/PATCH 200; POST 201 (204 se não devolve corpo). Um único status de
 *                sucesso por rota. Erros: 400 entrada inválida, 401 autenticação, 403 sem
 *                permissão, 404 não encontrado, 409 conflito com o estado atual.
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
  const respostas = new InMemoryRespostasRepository();
  const feedbacks = new InMemoryFeedbacksRepository();
  const fotos = new InMemoryFotosRepository();
  const medidas = new InMemoryMedidasRepository();
  const exercicios = new InMemoryExerciciosRepository();
  const treinos = new InMemoryTreinosRepository();
  const nutricao = new InMemoryNutricaoRepository();
  // Evolução só lê: junta peso/medidas, respostas e questionários.
  const evolucao = new InMemoryEvolucaoRepository(medidas, respostas, questionarios);
  // Painel só lê: calcula frequência e carga a partir das execuções de treino.
  const dashboard = new InMemoryDashboardRepository(treinos);
  // Arquivos (fotos): R2/S3 se as variáveis STORAGE_* existirem; senão as rotas de arquivo dão 503.
  const storage = createObjectStorage(env);

  const router = Router();

  router.use(createAlunosRouter(alunos, convites));
  router.use(
    createConvitesRouter(alunos, convites, {
      urlBase: env.CONVITE_URL_BASE,
      validadeHoras: env.CONVITE_VALIDADE_HORAS,
    }),
  );
  router.use(createQuestionariosRouter(questionarios, alunos));
  // Enviar as respostas de um feedback muda o status dele (BE-FBK-04).
  const feedbacksService = new FeedbacksService(feedbacks, questionarios, alunos);
  router.use(createRespostasRouter(respostas, questionarios, alunos, feedbacksService));
  router.use(createFeedbacksRouter(feedbacks, questionarios, alunos));
  router.use(
    createFotosRouter(fotos, alunos, storage, {
      tamanhoMaximoBytes: env.FOTO_TAMANHO_MAXIMO_MB * 1024 * 1024,
      urlValidadeSegundos: env.FOTO_URL_VALIDADE_SEGUNDOS,
    }),
  );
  router.use(createMedidasRouter(medidas, alunos));
  router.use(createEvolucaoRouter(evolucao, alunos));
  router.use(createExerciciosRouter(exercicios));
  router.use(createTreinosRouter(treinos, alunos, exercicios));
  router.use(createDashboardRouter(dashboard, alunos, exercicios));
  router.use(createNutricaoRouter(nutricao, alunos));

  return router;
}

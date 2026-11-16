import { Router } from 'express';

import { EvolucaoController } from './evolucao.controller';
import { EvolucaoService } from './evolucao.service';

import type { EvolucaoRepository } from './evolucao.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * Evolução do aluno (gráficos).
 *   BE-EVO-01 · Séries temporais: peso, medidas e perguntas flagadas (só leitura)
 *     GET /alunos/:alunoId/evolucao          → todas as séries (período opcional)
 *
 * O repositório entra por parâmetro (montado em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createEvolucaoRouter(
  repository: EvolucaoRepository,
  alunos: AlunosRepository,
): Router {
  const controller = new EvolucaoController(new EvolucaoService(repository, alunos));
  const router = Router();

  router.get('/alunos/:alunoId/evolucao', controller.buscar);

  return router;
}

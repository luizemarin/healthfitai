import { Router } from 'express';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import type { DashboardRepository } from './dashboard.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';
import type { ExerciciosRepository } from '../exercicios/exercicios.repository';

/**
 * Painel do profissional (só leitura).
 *   BE-DSH-01 · Frequência e progressão de carga (a partir dos treinos finalizados)
 *     GET /dashboard/alunos            → visão consolidada: frequência de cada aluno
 *     GET /alunos/:alunoId/dashboard   → detalhe: frequência por semana e progressão de carga
 *
 * O repositório entra por parâmetro (montado em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createDashboardRouter(
  repository: DashboardRepository,
  alunos: AlunosRepository,
  exercicios: ExerciciosRepository,
): Router {
  const controller = new DashboardController(new DashboardService(repository, alunos, exercicios));
  const router = Router();

  router.get('/dashboard/alunos', controller.listar);
  router.get('/alunos/:alunoId/dashboard', controller.buscarDoAluno);

  return router;
}

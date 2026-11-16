import { Router } from 'express';

import { TreinosController } from './treinos.controller';
import { TreinosService } from './treinos.service';

import type { TreinosRepository } from './treinos.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';
import type { ExerciciosRepository } from '../exercicios/exercicios.repository';

/**
 * Treinos do aluno.
 *   BE-TRE-01 · Criação e duplicação (séries, repetições, descanso e carga)
 *     POST   /alunos/:alunoId/treinos     → montar treino
 *     GET    /alunos/:alunoId/treinos     → listar os treinos ativos do aluno
 *     GET    /treinos/:id                 → detalhar (o app usa para treinar)
 *     PATCH  /treinos/:id                 → editar nome e/ou lista de exercícios
 *     POST   /treinos/:id/duplicar        → copiar (para o mesmo ou outro aluno)
 *     DELETE /treinos/:id                 → remover (lógico: o histórico fica)
 *   BE-TRE-02 · Execução
 *     POST   /treinos/:treinoId/execucoes → "Finalizar treino": registra tudo de uma vez
 *     GET    /execucoes-treino/:id        → detalhar um treino feito
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createTreinosRouter(
  repository: TreinosRepository,
  alunos: AlunosRepository,
  exercicios: ExerciciosRepository,
): Router {
  const controller = new TreinosController(new TreinosService(repository, alunos, exercicios));
  const router = Router();

  router.post('/alunos/:alunoId/treinos', controller.criar);
  router.get('/alunos/:alunoId/treinos', controller.listar);
  router.get('/treinos/:id', controller.buscarPorId);
  router.patch('/treinos/:id', controller.editar);
  router.post('/treinos/:id/duplicar', controller.duplicar);
  router.delete('/treinos/:id', controller.remover);

  router.post('/treinos/:treinoId/execucoes', controller.finalizarExecucao);
  router.get('/execucoes-treino/:id', controller.buscarExecucao);

  return router;
}

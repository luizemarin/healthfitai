import { Router } from 'express';

import { ExerciciosController } from './exercicios.controller';
import { ExerciciosService } from './exercicios.service';

import type { ExerciciosRepository } from './exercicios.repository';

/**
 * Biblioteca de exercícios do profissional.
 *   BE-EXE-01 · CRUD
 *     POST   /exercicios          → criar
 *     GET    /exercicios          → listar (busca, grupo muscular, paginação)
 *     GET    /exercicios/:id      → detalhar
 *     PATCH  /exercicios/:id      → editar
 *     DELETE /exercicios/:id      → excluir (lógico: treinos antigos continuam íntegros)
 *
 * O repositório entra por parâmetro (montado em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createExerciciosRouter(repository: ExerciciosRepository): Router {
  const controller = new ExerciciosController(new ExerciciosService(repository));
  const router = Router();

  router.post('/exercicios', controller.criar);
  router.get('/exercicios', controller.listar);
  router.get('/exercicios/:id', controller.buscarPorId);
  router.patch('/exercicios/:id', controller.editar);
  router.delete('/exercicios/:id', controller.excluir);

  return router;
}

import { Router } from 'express';

import { AlunosController } from './alunos.controller';
import { AlunosService } from './alunos.service';

import type { AlunosRepository } from './alunos.repository';
import type { ConvitesRepository } from '../convites/convites.repository';

/**
 * Alunos do profissional.
 *   BE-ALU-01 · CRUD
 *     POST  /alunos                → cadastrar
 *     GET   /alunos                → listar (busca, filtros, paginação)
 *     GET   /alunos/:id            → detalhar
 *     PATCH /alunos/:id            → editar
 *   BE-ALU-02 · Ativar/desativar (sem DELETE: histórico nunca é apagado)
 *     POST  /alunos/:id/desativar
 *     POST  /alunos/:id/ativar
 *   BE-ALU-03 · Perfil
 *     GET   /alunos/:id/perfil
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createAlunosRouter(
  repository: AlunosRepository,
  convites: ConvitesRepository,
): Router {
  const controller = new AlunosController(new AlunosService(repository, convites));
  const router = Router();

  router.post('/alunos', controller.criar);
  router.get('/alunos', controller.listar);
  router.get('/alunos/:id', controller.buscarPorId);
  router.patch('/alunos/:id', controller.atualizar);
  router.get('/alunos/:id/perfil', controller.perfil);
  router.post('/alunos/:id/desativar', controller.desativar);
  router.post('/alunos/:id/ativar', controller.ativar);

  return router;
}

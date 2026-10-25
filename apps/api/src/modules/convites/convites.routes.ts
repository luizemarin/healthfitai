import { Router } from 'express';

import { ConvitesController } from './convites.controller';
import { ConvitesService } from './convites.service';

import type { ConvitesRepository } from './convites.repository';
import type { ConvitesConfig } from './convites.service';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * BE-ALU-04 · Convite por link único (sempre de um aluno do profissional).
 *   GET  /alunos/:alunoId/convites           → histórico com status
 *   POST /alunos/:alunoId/convites           → gerar
 *   POST /alunos/:alunoId/convites/reenviar  → revogar o atual e gerar outro
 *   POST /alunos/:alunoId/convites/revogar   → revogar o atual
 */
export function createConvitesRouter(
  alunos: AlunosRepository,
  convites: ConvitesRepository,
  config: ConvitesConfig,
): Router {
  const controller = new ConvitesController(new ConvitesService(alunos, convites, config));
  const router = Router();

  router.get('/alunos/:alunoId/convites', controller.listar);
  router.post('/alunos/:alunoId/convites', controller.gerar);
  router.post('/alunos/:alunoId/convites/reenviar', controller.reenviar);
  router.post('/alunos/:alunoId/convites/revogar', controller.revogar);

  return router;
}

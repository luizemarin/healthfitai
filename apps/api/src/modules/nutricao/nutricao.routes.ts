import { Router } from 'express';

import { NutricaoController } from './nutricao.controller';
import { NutricaoService } from './nutricao.service';

import type { NutricaoRepository } from './nutricao.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * BE-NUT-01 · Planejamento nutricional (plano alimentar do aluno).
 *   POST   /alunos/:alunoId/planos-nutricionais        → criar plano (substitui o em uso)
 *   GET    /alunos/:alunoId/planos-nutricionais        → histórico de planos do aluno
 *   GET    /alunos/:alunoId/planos-nutricionais/ativo  → plano em uso (o app mostra este)
 *   GET    /planos-nutricionais/:id                    → detalhar qualquer plano
 *   PATCH  /planos-nutricionais/:id                    → editar o plano em uso
 *   DELETE /planos-nutricionais/:id                    → encerrar o plano em uso (fica no histórico)
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createNutricaoRouter(
  repository: NutricaoRepository,
  alunos: AlunosRepository,
): Router {
  const controller = new NutricaoController(new NutricaoService(repository, alunos));
  const router = Router();

  router.post('/alunos/:alunoId/planos-nutricionais', controller.criar);
  router.get('/alunos/:alunoId/planos-nutricionais', controller.listar);
  router.get('/alunos/:alunoId/planos-nutricionais/ativo', controller.buscarAtivo);
  router.get('/planos-nutricionais/:id', controller.buscarPorId);
  router.patch('/planos-nutricionais/:id', controller.editar);
  router.delete('/planos-nutricionais/:id', controller.encerrar);

  return router;
}

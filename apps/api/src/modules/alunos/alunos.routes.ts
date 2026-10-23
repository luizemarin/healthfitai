import { Router } from 'express';

import { AlunosController } from './alunos.controller';
import { InMemoryAlunosRepository } from './alunos.memory-repository';
import { AlunosService } from './alunos.service';

import type { AlunosRepository } from './alunos.repository';

/**
 * BE-ALU-01 · CRUD de alunos do profissional.
 *   POST  /alunos      → cadastrar
 *   GET   /alunos      → listar (busca, filtros, paginação)
 *   GET   /alunos/:id  → detalhar
 *   PATCH /alunos/:id  → editar
 * Sem DELETE: histórico nunca é apagado; desativar é o BE-ALU-02.
 *
 * O repositório entra por parâmetro: quando a tabela existir (DB-004), basta
 * passar a implementação com Prisma aqui (ou em routes.ts).
 */
export function createAlunosRouter(
  repository: AlunosRepository = new InMemoryAlunosRepository(),
): Router {
  const controller = new AlunosController(new AlunosService(repository));
  const router = Router();

  router.post('/alunos', controller.criar);
  router.get('/alunos', controller.listar);
  router.get('/alunos/:id', controller.buscarPorId);
  router.patch('/alunos/:id', controller.atualizar);

  return router;
}

import { Router } from 'express';

import { MedidasController } from './medidas.controller';
import { MedidasService } from './medidas.service';

import type { MedidasRepository } from './medidas.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * Peso e medidas do aluno.
 *   BE-MED-02 · Tipos de medida configuráveis, cada um com sua unidade (sem DELETE)
 *     GET   /tipos-medida                    → listar (na 1ª vez, copia os padrão)
 *     POST  /tipos-medida                    → adicionar
 *     PATCH /tipos-medida/:id                → editar nome/unidade (unidade só sem registros)
 *     POST  /tipos-medida/:id/desativar      → "remover" (o histórico fica)
 *     POST  /tipos-medida/:id/ativar
 *   BE-MED-01 · Registro de peso e medidas (histórico datado, nada é sobrescrito)
 *     POST  /alunos/:alunoId/pesos           → registrar pesagem
 *     GET   /alunos/:alunoId/pesos           → histórico (período, paginação)
 *     POST  /alunos/:alunoId/medidas         → registrar as medidas de um dia (várias de uma vez)
 *     GET   /alunos/:alunoId/medidas         → histórico (tipo, período, paginação)
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createMedidasRouter(
  repository: MedidasRepository,
  alunos: AlunosRepository,
): Router {
  const controller = new MedidasController(new MedidasService(repository, alunos));
  const router = Router();

  router.get('/tipos-medida', controller.listarTipos);
  router.post('/tipos-medida', controller.criarTipo);
  router.patch('/tipos-medida/:id', controller.editarTipo);
  router.post('/tipos-medida/:id/desativar', controller.desativarTipo);
  router.post('/tipos-medida/:id/ativar', controller.ativarTipo);

  router.post('/alunos/:alunoId/pesos', controller.registrarPeso);
  router.get('/alunos/:alunoId/pesos', controller.listarPesos);
  router.post('/alunos/:alunoId/medidas', controller.registrarMedidas);
  router.get('/alunos/:alunoId/medidas', controller.listarMedidas);

  return router;
}

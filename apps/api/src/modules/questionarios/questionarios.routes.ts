import { Router } from 'express';

import { QuestionariosController } from './questionarios.controller';
import { QuestionariosService } from './questionarios.service';

import type { QuestionariosRepository } from './questionarios.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * Motor de questionários: modelos de anamnese, avaliação e feedback.
 *   BE-QST-01 · CRUD (sem DELETE: desativar preserva o histórico)
 *     POST  /modelos                    → criar (já com as perguntas)
 *     GET   /modelos                    → listar (busca, tipo, situação, paginação)
 *     GET   /modelos/:id                → detalhar (com as perguntas da versão atual)
 *     PUT   /modelos/:id                → editar (nome, sexo-alvo e perguntas)
 *     POST  /modelos/:id/duplicar       → copiar para um modelo novo
 *     POST  /modelos/:id/desativar
 *     POST  /modelos/:id/ativar
 *   BE-QST-02 · Tipos de pergunta e BE-QST-03 · flag de evolução → validados no corpo
 *   BE-QST-04 · Versionamento
 *     GET   /modelos/:id/versoes          → histórico de versões
 *     GET   /modelos/:id/versoes/:numero  → perguntas daquela versão
 *   BE-QST-05 · Anamnese masculina/feminina
 *     GET   /alunos/:alunoId/anamnese/modelo → modelo escolhido pelo sexo do aluno
 *   BE-QST-06 · Avaliação físico-postural → modelo padrão (aparece em GET /modelos)
 *
 * O repositório entra por parâmetro (montado em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createQuestionariosRouter(
  repository: QuestionariosRepository,
  alunos: AlunosRepository,
): Router {
  const controller = new QuestionariosController(new QuestionariosService(repository, alunos));
  const router = Router();

  router.post('/modelos', controller.criar);
  router.get('/modelos', controller.listar);
  router.get('/modelos/:id', controller.buscarPorId);
  router.put('/modelos/:id', controller.editar);
  router.post('/modelos/:id/duplicar', controller.duplicar);
  router.post('/modelos/:id/desativar', controller.desativar);
  router.post('/modelos/:id/ativar', controller.ativar);
  router.get('/modelos/:id/versoes', controller.listarVersoes);
  router.get('/modelos/:id/versoes/:numero', controller.buscarVersao);
  router.get('/alunos/:alunoId/anamnese/modelo', controller.anamneseDoAluno);

  return router;
}

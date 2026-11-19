import { Router } from 'express';

import { RespostasController } from './respostas.controller';
import { RespostasService } from './respostas.service';

import type { RespostasRepository } from './respostas.repository';
import type { RespostaDeFeedback } from './respostas.service';
import type { AlunosRepository } from '../alunos/alunos.repository';
import type { QuestionariosRepository } from '../questionarios/questionarios.repository';

/**
 * Respostas dos questionários de um aluno (submissão = um preenchimento).
 *   BE-RSP-02 · Rascunho com autosave
 *     POST  /alunos/:alunoId/submissoes                 → abrir (ou retomar o rascunho aberto)
 *     PATCH /alunos/:alunoId/submissoes/:id             → autosave (só as perguntas enviadas)
 *   BE-RSP-01 · Registro final, datado e imutável
 *     POST  /alunos/:alunoId/submissoes/:id/finalizar   → enviar
 *   BE-RSP-03 · Avaliação pelo profissional → mesmo fluxo; "respondidoEm" no finalizar
 *   BE-RSP-04 · Histórico
 *     GET   /alunos/:alunoId/submissoes                 → finais por tipo/modelo/período
 *     GET   /alunos/:alunoId/submissoes/:id             → detalhe com perguntas e valores
 *
 * BE-FBK-04 · Ao enviar um feedback com "feedbackId", ele passa a "respondido"
 * (`feedbacks` = FeedbacksService, montado em routes.ts).
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createRespostasRouter(
  repository: RespostasRepository,
  questionarios: QuestionariosRepository,
  alunos: AlunosRepository,
  feedbacks: RespostaDeFeedback,
): Router {
  const controller = new RespostasController(
    new RespostasService(repository, questionarios, alunos, feedbacks),
  );
  const router = Router();

  router.post('/alunos/:alunoId/submissoes', controller.abrir);
  router.get('/alunos/:alunoId/submissoes', controller.listar);
  router.get('/alunos/:alunoId/submissoes/:id', controller.buscar);
  router.patch('/alunos/:alunoId/submissoes/:id', controller.salvarRascunho);
  router.post('/alunos/:alunoId/submissoes/:id/finalizar', controller.finalizar);

  return router;
}

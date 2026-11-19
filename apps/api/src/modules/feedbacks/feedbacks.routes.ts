import { Router } from 'express';

import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

import type { FeedbacksRepository } from './feedbacks.repository';
import type { AlunosRepository } from '../alunos/alunos.repository';
import type { QuestionariosRepository } from '../questionarios/questionarios.repository';

/**
 * Feedbacks recorrentes do aluno.
 *   BE-FBK-01 · Agendamento (semanal, quinzenal, mensal ou avulso), sem DELETE
 *     POST  /alunos/:alunoId/feedback-agendamentos                → agendar
 *     GET   /alunos/:alunoId/feedback-agendamentos                → listar (situação, paginação)
 *     GET   /alunos/:alunoId/feedback-agendamentos/:id            → detalhar
 *     PATCH /alunos/:alunoId/feedback-agendamentos/:id            → editar (só os campos enviados)
 *     POST  /alunos/:alunoId/feedback-agendamentos/:id/desativar
 *     POST  /alunos/:alunoId/feedback-agendamentos/:id/ativar
 *   BE-FBK-03 · Lembrete → "lembreteDias" no agendamento; o job usa processarLembretes()
 *   BE-FBK-04 · Status (as mudanças vêm do job e da resposta do aluno, não de rota:
 *               POST /alunos/:alunoId/submissoes/:id/finalizar com "feedbackId")
 *     GET   /alunos/:alunoId/feedbacks                            → listar por status
 *     GET   /alunos/:alunoId/feedbacks/:id                        → detalhe com comentários
 *   BE-FBK-05 · Comentários do profissional
 *     POST  /alunos/:alunoId/feedbacks/:id/comentarios
 *
 * Os repositórios entram por parâmetro (montados em routes.ts): hoje em memória;
 * com o Prisma basta trocar a implementação lá.
 */
export function createFeedbacksRouter(
  repository: FeedbacksRepository,
  questionarios: QuestionariosRepository,
  alunos: AlunosRepository,
): Router {
  const controller = new FeedbacksController(
    new FeedbacksService(repository, questionarios, alunos),
  );
  const router = Router();

  router.post('/alunos/:alunoId/feedback-agendamentos', controller.criarAgendamento);
  router.get('/alunos/:alunoId/feedback-agendamentos', controller.listarAgendamentos);
  router.get('/alunos/:alunoId/feedback-agendamentos/:id', controller.buscarAgendamento);
  router.patch('/alunos/:alunoId/feedback-agendamentos/:id', controller.editarAgendamento);
  router.post(
    '/alunos/:alunoId/feedback-agendamentos/:id/desativar',
    controller.desativarAgendamento,
  );
  router.post('/alunos/:alunoId/feedback-agendamentos/:id/ativar', controller.ativarAgendamento);

  router.get('/alunos/:alunoId/feedbacks', controller.listarFeedbacks);
  router.get('/alunos/:alunoId/feedbacks/:id', controller.buscarFeedback);
  router.post('/alunos/:alunoId/feedbacks/:id/comentarios', controller.comentar);

  return router;
}

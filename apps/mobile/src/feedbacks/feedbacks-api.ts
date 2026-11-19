import { api, unwrap } from '../api/client';
import { doAluno } from '../questionario/submissoes-api';

import type { components } from '../api/generated/schema';
import type { Identificacao } from '../questionario/submissoes-api';

/**
 * Chamadas à API usadas pelos feedbacks do aluno, tipadas pelo contrato OpenAPI.
 *   GET /alunos/:alunoId/feedbacks       → lista por status, paginada (BE-FBK-04)
 *   GET /alunos/:alunoId/feedbacks/:id   → status, datas e comentários do profissional (BE-FBK-05)
 * Responder usa as rotas comuns de questionário (questionario/submissoes-api.ts).
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type FeedbackResumo = Schemas['FeedbackResumo'];
export type Feedback = Schemas['Feedback'];
export type ComentarioFeedback = Schemas['ComentarioFeedback'];
export type StatusFeedback = FeedbackResumo['status'];

/** Itens por página na lista. */
const POR_PAGINA = 20;

export interface PaginaFeedbacks {
  itens: FeedbackResumo[];
  total: number;
  temMais: boolean;
}

export const feedbacksApi = {
  /** Uma página dos feedbacks do aluno com o status pedido, mais recentes primeiro. */
  listar: async (
    quem: Identificacao,
    status: StatusFeedback,
    page: number,
  ): Promise<PaginaFeedbacks> => {
    const { data, meta } = await unwrap(
      api.GET('/alunos/{alunoId}/feedbacks', {
        params: {
          ...doAluno(quem),
          query: { status, page, pageSize: POR_PAGINA, sort: '-enviadoEm' },
        },
      }),
    );
    return { itens: data, total: meta.totalItems, temMais: meta.page < meta.totalPages };
  },

  /** Detalhe com os comentários do profissional (do mais antigo ao mais novo). */
  buscar: async (quem: Identificacao, id: string): Promise<Feedback> =>
    unwrap(
      api.GET('/alunos/{alunoId}/feedbacks/{id}', {
        params: { header: doAluno(quem).header, path: { alunoId: quem.alunoId, id } },
      }),
    ),
};

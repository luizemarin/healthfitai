import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components } from '../../api/generated/schema';
import type { ListaModelos, Submissao } from '../questionarios/questionarios-api';

/**
 * Chamadas à API de feedbacks usadas no painel (FE-FBK-01..03), tipadas pelo contrato OpenAPI.
 *   agendar          → BE-FBK-01/03 (recorrência, primeira liberação e lembrete)
 *   listar / buscar  → BE-FBK-04 (feedbacks por status, detalhe com comentários)
 *   comentar         → BE-FBK-05 (comentário visível ao aluno)
 *   respostas        → BE-RSP-04 (o que o aluno respondeu)
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Agendamento = Schemas['AgendamentoFeedback'];
export type CriarAgendamento = Schemas['CriarAgendamentoFeedback'];
export type FeedbackResumo = Schemas['FeedbackResumo'];
export type Feedback = Schemas['Feedback'];
export type Comentario = Schemas['ComentarioFeedback'];
export type Recorrencia = Agendamento['recorrencia'];
export type StatusFeedback = Feedback['status'];

export interface ListaFeedbacks {
  data: FeedbackResumo[];
  meta: Schemas['PaginationMeta'];
}

export const FEEDBACKS_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

export const feedbacksApi = {
  /** Modelos de feedback ativos, para escolher no agendamento. */
  modelosAtivos: async (signal: AbortSignal): Promise<ListaModelos> =>
    unwrap(
      api.GET('/modelos', {
        params: { header: header(), query: { tipo: 'feedback', ativo: 'true', pageSize: 100 } },
        signal,
      }),
    ),

  agendar: async (alunoId: string, body: CriarAgendamento): Promise<Agendamento> =>
    unwrap(
      api.POST('/alunos/{alunoId}/feedback-agendamentos', {
        params: { header: header(), path: { alunoId } },
        body,
      }),
    ),

  /** Feedbacks do aluno, mais recentes primeiro. Sem status = todos. */
  listar: async (
    alunoId: string,
    filtros: { status?: StatusFeedback | undefined; page: number },
    signal: AbortSignal,
  ): Promise<ListaFeedbacks> =>
    unwrap(
      api.GET('/alunos/{alunoId}/feedbacks', {
        params: {
          header: header(),
          path: { alunoId },
          query: {
            page: filtros.page,
            pageSize: FEEDBACKS_POR_PAGINA,
            // Filtro vazio não vai na URL (?status= seria recusado pela API).
            ...(filtros.status && { status: filtros.status }),
          },
        },
        signal,
      }),
    ),

  /** Detalhe com os comentários (do mais antigo ao mais novo). */
  buscar: async (alunoId: string, id: string, signal: AbortSignal): Promise<Feedback> =>
    unwrap(
      api.GET('/alunos/{alunoId}/feedbacks/{id}', {
        params: { header: header(), path: { alunoId, id } },
        signal,
      }),
    ),

  comentar: async (alunoId: string, id: string, texto: string): Promise<Comentario> =>
    unwrap(
      api.POST('/alunos/{alunoId}/feedbacks/{id}/comentarios', {
        params: { header: header(), path: { alunoId, id } },
        body: { texto },
      }),
    ),

  /** Respostas do aluno, com as perguntas como estavam na versão respondida. */
  respostas: async (
    alunoId: string,
    submissaoId: string,
    signal: AbortSignal,
  ): Promise<Submissao> =>
    unwrap(
      api.GET('/alunos/{alunoId}/submissoes/{id}', {
        params: { header: header(), path: { alunoId, id: submissaoId } },
        signal,
      }),
    ),
};

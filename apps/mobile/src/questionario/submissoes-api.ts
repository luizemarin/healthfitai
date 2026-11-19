import { api, unwrap } from '../api/client';
import { config } from '../config';

import type { components } from '../api/generated/schema';

/**
 * Chamadas de preenchimento de questionário (anamnese e feedback usam as mesmas rotas):
 *   POST  /alunos/:alunoId/submissoes                 → abre o rascunho ou retoma o aberto (BE-RSP-02)
 *   PATCH /alunos/:alunoId/submissoes/:id             → autosave: grava só as perguntas enviadas
 *   POST  /alunos/:alunoId/submissoes/:id/finalizar   → envia (vira registro final, BE-RSP-01)
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Submissao = Schemas['Submissao'];
export type PerguntaRespondida = Schemas['PerguntaRespondida'];
export type RespostaInformada = Schemas['SalvarRascunho']['respostas'][number];

/** Quem é o aluno nas rotas da API. */
export interface Identificacao {
  alunoId: string;
  profissionalId: string;
}

/**
 * PROVISÓRIO até o login do aluno trazer esses dados no token (BE-AUT-01): por enquanto vêm do
 * .env (ver config.ts). Quando o token chegar, só esta função muda; telas e hooks continuam iguais.
 * null = não configurado.
 */
export function identificacaoDoAluno(): Identificacao | null {
  const { alunoId, profissionalId } = config;
  return alunoId && profissionalId ? { alunoId, profissionalId } : null;
}

interface ParamsDoAluno {
  header: { 'x-profissional-id': string };
  path: { alunoId: string };
}

/** Header e path comuns às rotas do aluno. */
export const doAluno = (quem: Identificacao): ParamsDoAluno => ({
  header: { 'x-profissional-id': quem.profissionalId },
  path: { alunoId: quem.alunoId },
});

const daSubmissao = (quem: Identificacao, id: string) => ({
  header: doAluno(quem).header,
  path: { alunoId: quem.alunoId, id },
});

export const submissoesApi = {
  /**
   * Abre o preenchimento do modelo. Se já existe um rascunho dele, a API devolve o mesmo, com as
   * respostas já salvas (retomar de onde parou).
   */
  abrir: async (quem: Identificacao, modeloId: string): Promise<Submissao> =>
    unwrap(api.POST('/alunos/{alunoId}/submissoes', { params: doAluno(quem), body: { modeloId } })),

  /** Autosave: grava só as perguntas enviadas (valor null apaga a resposta). */
  salvarRascunho: async (
    quem: Identificacao,
    id: string,
    respostas: RespostaInformada[],
  ): Promise<Submissao> =>
    unwrap(
      api.PATCH('/alunos/{alunoId}/submissoes/{id}', {
        params: daSubmissao(quem, id),
        body: { respostas },
      }),
    ),

  /**
   * Envia as respostas, junto com as últimas alterações que ainda não tinham sido salvas.
   * `feedbackId`: só no feedback; o back marca aquele feedback como respondido (BE-FBK-04).
   */
  finalizar: async (
    quem: Identificacao,
    id: string,
    respostas: RespostaInformada[],
    feedbackId?: string,
  ): Promise<Submissao> =>
    unwrap(
      api.POST('/alunos/{alunoId}/submissoes/{id}/finalizar', {
        params: daSubmissao(quem, id),
        body: {
          // Lista vazia seria recusada pela API ("Envie pelo menos uma resposta."): sem alterações, não vai.
          ...(respostas.length > 0 && { respostas }),
          ...(feedbackId && { feedbackId }),
        },
      }),
    ),
};

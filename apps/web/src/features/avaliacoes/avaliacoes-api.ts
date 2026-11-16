import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components } from '../../api/generated/schema';
import type { ListaModelos, ListaSubmissoes, Submissao } from '../questionarios/questionarios-api';

/**
 * Chamadas à API usadas nas avaliações físico-posturais (FE-AVA-01/02).
 * A avaliação é um questionário do tipo "avaliacao" preenchido pelo profissional:
 *   abrir     → BE-RSP-02 (cria o rascunho ou retoma o que já está aberto)
 *   finalizar → BE-RSP-01/03 (registro final, datado e imutável)
 *   listar / buscar → BE-RSP-04 (histórico)
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
export type FinalizarAvaliacao = components['schemas']['FinalizarSubmissao'];
export type RespostaAvaliacao = NonNullable<FinalizarAvaliacao['respostas']>[number];

export const AVALIACOES_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

export const avaliacoesApi = {
  /** Modelos de avaliação ativos (o padrão tem os 5 testes — BE-QST-06). */
  modelosAtivos: async (signal: AbortSignal): Promise<ListaModelos> =>
    unwrap(
      api.GET('/modelos', {
        params: { header: header(), query: { tipo: 'avaliacao', ativo: 'true', pageSize: 100 } },
        signal,
      }),
    ),

  abrir: async (alunoId: string, modeloId: string): Promise<Submissao> =>
    unwrap(
      api.POST('/alunos/{alunoId}/submissoes', {
        params: { header: header(), path: { alunoId } },
        body: { modeloId },
      }),
    ),

  finalizar: async (alunoId: string, id: string, body: FinalizarAvaliacao): Promise<Submissao> =>
    unwrap(
      api.POST('/alunos/{alunoId}/submissoes/{id}/finalizar', {
        params: { header: header(), path: { alunoId, id } },
        body,
      }),
    ),

  /** Avaliações registradas, mais recentes primeiro (rascunho não entra). */
  listar: async (alunoId: string, page: number, signal: AbortSignal): Promise<ListaSubmissoes> =>
    unwrap(
      api.GET('/alunos/{alunoId}/submissoes', {
        params: {
          header: header(),
          path: { alunoId },
          query: {
            tipo: 'avaliacao',
            sort: '-respondidoEm',
            page,
            pageSize: AVALIACOES_POR_PAGINA,
          },
        },
        signal,
      }),
    ),

  buscar: async (alunoId: string, id: string, signal: AbortSignal): Promise<Submissao> =>
    unwrap(
      api.GET('/alunos/{alunoId}/submissoes/{id}', {
        params: { header: header(), path: { alunoId, id } },
        signal,
      }),
    ),
};

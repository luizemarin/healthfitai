import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components } from '../../api/generated/schema';

/**
 * Chamadas à API de treinos (BE-TRE-01) usadas no painel (FE-TRE-01),
 * tipadas pelo contrato OpenAPI. Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Treino = Schemas['Treino'];
export type ExercicioResumo = Schemas['ExercicioResumo'];
export type CriarTreino = Schemas['CriarTreino'];
export type EditarTreino = Schemas['EditarTreino'];
export type ItemTreinoEntrada = Schemas['ItemTreinoEntrada'];

export interface ListaTreinos {
  data: Treino[];
  meta: Schemas['PaginationMeta'];
}

export const TREINOS_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

const porId = (id: string) => ({ params: { header: header(), path: { id } } });

export const treinosApi = {
  /** Treinos ativos do aluno, em ordem de nome (os removidos não aparecem). */
  listar: async (alunoId: string, page: number, signal: AbortSignal): Promise<ListaTreinos> =>
    unwrap(
      api.GET('/alunos/{alunoId}/treinos', {
        params: {
          header: header(),
          path: { alunoId },
          query: { page, pageSize: TREINOS_POR_PAGINA, sort: 'nome' },
        },
        signal,
      }),
    ),

  buscar: async (id: string, signal: AbortSignal): Promise<Treino> =>
    unwrap(api.GET('/treinos/{id}', { ...porId(id), signal })),

  criar: async (alunoId: string, body: CriarTreino): Promise<Treino> =>
    unwrap(
      api.POST('/alunos/{alunoId}/treinos', {
        params: { header: header(), path: { alunoId } },
        body,
      }),
    ),

  /** "exercicios" substitui a lista inteira (a ordem da lista é a ordem do treino). */
  editar: async (id: string, body: EditarTreino): Promise<Treino> =>
    unwrap(api.PATCH('/treinos/{id}', { ...porId(id), body })),

  /** Sem corpo: cópia para o mesmo aluno, com o nome "<nome> (cópia)". */
  duplicar: async (id: string): Promise<Treino> =>
    unwrap(api.POST('/treinos/{id}/duplicar', porId(id))),
};

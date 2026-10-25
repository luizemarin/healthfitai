import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components, paths } from '../../api/generated/schema';

/**
 * Chamadas à API de alunos e convites (BE-ALU-01..04), tipadas pelo contrato OpenAPI.
 * As telas usam só estas funções; qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Aluno = Schemas['Aluno'];
export type PerfilAluno = Schemas['PerfilAluno'];
export type CriarAluno = Schemas['CriarAluno'];
export type AtualizarAluno = Schemas['AtualizarAluno'];
export type Convite = Schemas['Convite'];
export type ConviteGerado = Schemas['ConviteGerado'];
export type Sexo = Aluno['sexo'];

export interface ListaAlunos {
  data: Aluno[];
  meta: Schemas['PaginationMeta'];
}

export interface FiltrosAlunos {
  q?: string | undefined;
  ativo?: 'true' | 'false' | undefined;
  sexo?: Sexo | undefined;
  page: number;
}

export const ALUNOS_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

type ListarAlunosQuery = NonNullable<paths['/alunos']['get']['parameters']['query']>;

/** Filtro vazio não vai na URL (?q=&sexo= seria recusado pela API). */
function query({ q, ativo, sexo, page }: FiltrosAlunos): ListarAlunosQuery {
  return {
    page,
    pageSize: ALUNOS_POR_PAGINA,
    ...(q && { q }),
    ...(ativo && { ativo }),
    ...(sexo && { sexo }),
  };
}

export const alunosApi = {
  listar: async (filtros: FiltrosAlunos, signal: AbortSignal): Promise<ListaAlunos> =>
    unwrap(
      api.GET('/alunos', {
        params: { header: header(), query: query(filtros) },
        signal,
      }),
    ),

  buscar: async (id: string, signal: AbortSignal): Promise<Aluno> =>
    unwrap(api.GET('/alunos/{id}', { params: { header: header(), path: { id } }, signal })),

  perfil: async (id: string, signal: AbortSignal): Promise<PerfilAluno> =>
    unwrap(api.GET('/alunos/{id}/perfil', { params: { header: header(), path: { id } }, signal })),

  criar: async (body: CriarAluno): Promise<Aluno> =>
    unwrap(api.POST('/alunos', { params: { header: header() }, body })),

  atualizar: async (id: string, body: AtualizarAluno): Promise<Aluno> =>
    unwrap(api.PATCH('/alunos/{id}', { params: { header: header(), path: { id } }, body })),

  desativar: async (id: string): Promise<Aluno> =>
    unwrap(api.POST('/alunos/{id}/desativar', { params: { header: header(), path: { id } } })),

  ativar: async (id: string): Promise<Aluno> =>
    unwrap(api.POST('/alunos/{id}/ativar', { params: { header: header(), path: { id } } })),
};

export const convitesApi = {
  listar: async (alunoId: string, signal: AbortSignal): Promise<{ data: Convite[] }> =>
    unwrap(
      api.GET('/alunos/{alunoId}/convites', {
        params: { header: header(), path: { alunoId } },
        signal,
      }),
    ),

  gerar: async (alunoId: string): Promise<ConviteGerado> =>
    unwrap(
      api.POST('/alunos/{alunoId}/convites', { params: { header: header(), path: { alunoId } } }),
    ),

  reenviar: async (alunoId: string): Promise<ConviteGerado> =>
    unwrap(
      api.POST('/alunos/{alunoId}/convites/reenviar', {
        params: { header: header(), path: { alunoId } },
      }),
    ),

  revogar: async (alunoId: string): Promise<void> =>
    unwrap(
      api.POST('/alunos/{alunoId}/convites/revogar', {
        params: { header: header(), path: { alunoId } },
      }),
    ),
};

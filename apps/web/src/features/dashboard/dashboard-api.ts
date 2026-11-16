import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components, paths } from '../../api/generated/schema';

/**
 * Chamadas à API do painel de frequência e progresso (BE-DSH-01) usadas no FE-DSH-01,
 * tipadas pelo contrato OpenAPI. Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type DashboardAlunos = Schemas['DashboardAlunos'];
export type DashboardAlunoItem = Schemas['DashboardAlunoItem'];
export type DashboardAluno = Schemas['DashboardAluno'];
export type DashboardSemana = Schemas['DashboardSemana'];
export type ProgressaoCarga = Schemas['DashboardProgressaoCarga'];
export type Periodo = Schemas['DashboardPeriodo'];

type ListarQuery = NonNullable<paths['/dashboard/alunos']['get']['parameters']['query']>;
export type OrdemDashboard = NonNullable<ListarQuery['sort']>;

/** Período escolhido na tela. Vazio = padrão do back (últimos 30 dias). */
export interface FiltroPeriodo {
  de?: string | undefined;
  ate?: string | undefined;
}

export interface FiltrosDashboard extends FiltroPeriodo {
  q?: string | undefined;
  /** Sem valor = padrão do back (só ativos). */
  ativo?: 'false' | undefined;
  sort?: OrdemDashboard | undefined;
  page: number;
}

export const ALUNOS_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

type PeriodoQuery = Pick<ListarQuery, 'de' | 'ate'>;

/** Filtro vazio não vai na URL (?q=&de= seria recusado pela API). */
function periodo({ de, ate }: FiltroPeriodo): PeriodoQuery {
  return { ...(de && { de }), ...(ate && { ate }) };
}

function query(filtros: FiltrosDashboard): ListarQuery {
  const { q, ativo, sort, page } = filtros;
  return {
    page,
    pageSize: ALUNOS_POR_PAGINA,
    ...periodo(filtros),
    ...(q && { q }),
    ...(ativo && { ativo }),
    ...(sort && { sort }),
  };
}

export const dashboardApi = {
  /** Visão consolidada: frequência de cada aluno no período. */
  listar: async (filtros: FiltrosDashboard, signal: AbortSignal): Promise<DashboardAlunos> =>
    unwrap(
      api.GET('/dashboard/alunos', {
        params: { header: header(), query: query(filtros) },
        signal,
      }),
    ),

  /** Um aluno: treinos semana a semana e progressão de carga por exercício. */
  aluno: async (
    alunoId: string,
    filtro: FiltroPeriodo,
    signal: AbortSignal,
  ): Promise<DashboardAluno> =>
    unwrap(
      api.GET('/alunos/{alunoId}/dashboard', {
        params: { header: header(), path: { alunoId }, query: periodo(filtro) },
        signal,
      }),
    ),
};

import { api, unwrap } from '../api/client';
import { doAluno } from '../questionario/submissoes-api';

import type { components } from '../api/generated/schema';
import type { Identificacao } from '../questionario/submissoes-api';

/**
 * Chamadas à API de treinos usadas pelo aluno, tipadas pelo contrato OpenAPI.
 *   GET  /alunos/:alunoId/treinos       → treinos ativos do aluno (BE-TRE-01)
 *   GET  /treinos/:id                   → um treino com os exercícios, na ordem (BE-TRE-01)
 *   POST /treinos/:treinoId/execucoes   → "Finalizar treino": registra tudo de uma vez (BE-TRE-02)
 *   GET  /alunos/:alunoId/dashboard     → frequência por semana e progressão de carga (BE-DSH-01)
 * Qualquer falha chega como ApiError.
 */
type Schemas = components['schemas'];
export type Treino = Schemas['Treino'];
export type ItemTreino = Treino['exercicios'][number];
export type FinalizarExecucao = Schemas['FinalizarExecucaoTreino'];
export type SerieFeita = FinalizarExecucao['series'][number];
export type EvolucaoTreino = Schemas['DashboardAluno'];
export type Semana = Schemas['DashboardSemana'];
export type ProgressaoCarga = Schemas['DashboardProgressaoCarga'];

/** Máximo da API por página; um aluno não costuma ter tantos treinos ativos ao mesmo tempo. */
const POR_PAGINA = 100;

export const treinosApi = {
  /** Treinos ativos, em ordem de nome (padrão da API). */
  listar: async (quem: Identificacao): Promise<Treino[]> =>
    unwrap(
      api.GET('/alunos/{alunoId}/treinos', {
        params: { ...doAluno(quem), query: { pageSize: POR_PAGINA } },
      }),
    ).then((pagina) => pagina.data),

  buscar: async (quem: Identificacao, id: string): Promise<Treino> =>
    unwrap(api.GET('/treinos/{id}', { params: { header: doAluno(quem).header, path: { id } } })),

  /** Reenviar o mesmo treino (mesmo `iniciadoEm`) não duplica: a API responde EXECUCAO_JA_REGISTRADA. */
  finalizar: async (
    quem: Identificacao,
    treinoId: string,
    execucao: FinalizarExecucao,
  ): Promise<void> => {
    await unwrap(
      api.POST('/treinos/{treinoId}/execucoes', {
        params: { header: doAluno(quem).header, path: { treinoId } },
        body: execucao,
      }),
    );
  },

  /**
   * MB-EVO-03 · Evolução do treino: mesma rota do painel do treinador. Sem filtro de período, a API
   * usa os últimos 30 dias até hoje (horário de Brasília).
   */
  evolucao: async (quem: Identificacao): Promise<EvolucaoTreino> =>
    unwrap(api.GET('/alunos/{alunoId}/dashboard', { params: doAluno(quem) })),
};

import { ApiError } from '../../api/api-error';
import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components } from '../../api/generated/schema';

/**
 * Chamadas à API de nutrição (BE-NUT-01) usadas no painel (FE-NUT-01),
 * tipadas pelo contrato OpenAPI. Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type PlanoNutricional = Schemas['PlanoNutricional'];
export type CriarPlanoNutricional = Schemas['CriarPlanoNutricional'];
export type EditarPlanoNutricional = Schemas['EditarPlanoNutricional'];
export type RefeicaoPlanoEntrada = Schemas['RefeicaoPlanoEntrada'];

export interface ListaPlanos {
  data: PlanoNutricional[];
  meta: Schemas['PaginationMeta'];
}

export const PLANOS_POR_PAGINA = 10;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

const porId = (id: string) => ({ params: { header: header(), path: { id } } });

export const nutricaoApi = {
  /**
   * Plano que o aluno está seguindo agora.
   * null = o aluno ainda não tem plano em uso (404 PLANO_NUTRICIONAL_NAO_DEFINIDO do back):
   * não é erro, a tela mostra o estado vazio.
   */
  buscarAtivo: async (alunoId: string, signal: AbortSignal): Promise<PlanoNutricional | null> => {
    try {
      return await unwrap(
        api.GET('/alunos/{alunoId}/planos-nutricionais/ativo', {
          params: { header: header(), path: { alunoId } },
          signal,
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PLANO_NUTRICIONAL_NAO_DEFINIDO') {
        return null;
      }
      throw error;
    }
  },

  /** Planos antigos (substituídos ou encerrados), do mais recente ao mais antigo. */
  listarHistorico: async (
    alunoId: string,
    page: number,
    signal: AbortSignal,
  ): Promise<ListaPlanos> =>
    unwrap(
      api.GET('/alunos/{alunoId}/planos-nutricionais', {
        params: {
          header: header(),
          path: { alunoId },
          query: { page, pageSize: PLANOS_POR_PAGINA, sort: '-criadoEm', ativo: 'false' },
        },
        signal,
      }),
    ),

  buscar: async (id: string, signal: AbortSignal): Promise<PlanoNutricional> =>
    unwrap(api.GET('/planos-nutricionais/{id}', { ...porId(id), signal })),

  /** O novo plano passa a ser o plano em uso; o anterior vai para o histórico. */
  criar: async (alunoId: string, body: CriarPlanoNutricional): Promise<PlanoNutricional> =>
    unwrap(
      api.POST('/alunos/{alunoId}/planos-nutricionais', {
        params: { header: header(), path: { alunoId } },
        body,
      }),
    ),

  /** Só o plano em uso. "refeicoes" substitui a lista inteira (a ordem da lista é a ordem do dia). */
  editar: async (id: string, body: EditarPlanoNutricional): Promise<PlanoNutricional> =>
    unwrap(api.PATCH('/planos-nutricionais/{id}', { ...porId(id), body })),

  /** O aluno fica sem plano em uso; este continua no histórico. */
  encerrar: async (id: string): Promise<void> =>
    unwrap(api.DELETE('/planos-nutricionais/{id}', porId(id))).then(() => undefined),
};

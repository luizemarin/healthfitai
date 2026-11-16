import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components } from '../../api/generated/schema';

/**
 * Chamadas à API de fotos usadas no painel (FE-FOT-01..03), tipadas pelo contrato OpenAPI.
 *   poses / adicionar / remover → BE-FOT-01 (padrão: frente, perfil e costas)
 *   galeria                     → BE-FOT-04 (fotos agrupadas por data e pose)
 *   comparar                    → BE-FOT-04 (antes/depois por pose)
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Pose = Schemas['PoseFoto'];
export type Foto = Schemas['Foto'];
export type FotosDoDia = Schemas['FotosDoDia'];

/**
 * ComparacaoFotos escrito à mão: o gerador (openapi-typescript) transforma a foto "nullable"
 * em `Foto & (Record<string, never> | null)`, que não aceita nem a foto nem o null.
 * O formato real (fotos.schemas.ts → comparacaoResponseSchema) é este.
 */
export interface Comparacao {
  antes: string;
  depois: string;
  /** Uma linha por pose, na ordem das poses. null = não há foto daquela pose na data. */
  poses: { pose: Foto['pose']; antes: Foto | null; depois: Foto | null }[];
}

export interface Galeria {
  data: FotosDoDia[];
  meta: Schemas['PaginationMeta'];
}

/** Dias com fotos por página (máximo da API: 100). As datas do comparador saem desta lista. */
export const DIAS_POR_PAGINA = 100;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

export const fotosApi = {
  /** Poses ativas, na ordem em que o app pede as fotos. */
  poses: async (signal: AbortSignal): Promise<Pose[]> =>
    unwrap(
      api.GET('/poses', { params: { header: header(), query: { ativa: 'true' } }, signal }),
    ).then((lista) => lista.data),

  /** A pose nova entra no fim da lista. */
  adicionarPose: async (nome: string): Promise<Pose> =>
    unwrap(api.POST('/poses', { params: { header: header() }, body: { nome } })),

  /** "Remover" = desativar: a pose some do app, mas as fotos antigas continuam guardadas. */
  removerPose: async (id: string): Promise<Pose> =>
    unwrap(api.POST('/poses/{id}/desativar', { params: { header: header(), path: { id } } })),

  /** Fotos do aluno por dia (mais recentes primeiro) e, dentro do dia, pela ordem das poses. */
  galeria: async (alunoId: string, page: number, signal: AbortSignal): Promise<Galeria> =>
    unwrap(
      api.GET('/alunos/{alunoId}/fotos', {
        params: {
          header: header(),
          path: { alunoId },
          query: { page, pageSize: DIAS_POR_PAGINA },
        },
        signal,
      }),
    ),

  /** Uma linha por pose com a foto de cada data (null = sem foto daquela pose na data). */
  comparar: async (
    alunoId: string,
    datas: { antes: string; depois: string },
    signal: AbortSignal,
  ): Promise<Comparacao> => {
    const resposta = await unwrap(
      api.GET('/alunos/{alunoId}/fotos/comparar', {
        params: { header: header(), path: { alunoId }, query: datas },
        signal,
      }),
    );
    // Ver o comentário de Comparacao (tipo gerado incorreto para o null).
    return resposta as unknown as Comparacao;
  },
};

import { api, unwrap } from '../api/client';
import { doAluno } from '../questionario/submissoes-api';

import type { components } from '../api/generated/schema';
import type { Identificacao } from '../questionario/submissoes-api';

/**
 * Chamadas à API de fotos usadas pelo aluno, tipadas pelo contrato OpenAPI.
 *   GET  /poses?ativa=true                 → poses pedidas pelo treinador, em ordem (BE-FOT-01)
 *   POST /alunos/:alunoId/fotos/envios     → 1) URL assinada para mandar o arquivo (BE-FOT-02)
 *   POST /alunos/:alunoId/fotos            → 2) confirma o envio: vira foto do aluno
 *   GET  /alunos/:alunoId/fotos            → galeria agrupada por data (BE-FOT-04)
 *   GET  /alunos/:alunoId/fotos/comparar   → antes/depois por pose (BE-FOT-04)
 * Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Pose = Schemas['PoseFoto'];
export type Foto = Schemas['Foto'];
export type FotosDoDia = Schemas['FotosDoDia'];
export type Envio = Schemas['EnvioFoto'];

/**
 * ComparacaoFotos escrito à mão (igual ao painel web): o gerador (openapi-typescript) transforma
 * a foto "nullable" em `Foto & (Record<string, never> | null)`, que não aceita nem a foto nem o
 * null. O formato real (fotos.schemas.ts → comparacaoResponseSchema) é este.
 */
export interface Comparacao {
  antes: string;
  depois: string;
  /** Uma linha por pose, na ordem das poses. null = não há foto daquela pose na data. */
  poses: { pose: Foto['pose']; antes: Foto | null; depois: Foto | null }[];
}

/** Dias com fotos por página (máximo da API: 100). As datas do comparador saem desta lista. */
const DIAS_POR_PAGINA = 100;

export interface PaginaGaleria {
  dias: FotosDoDia[];
  temMais: boolean;
}

export const fotosApi = {
  /** Poses ativas, na ordem em que o treinador pede as fotos. */
  poses: async (quem: Identificacao): Promise<Pose[]> =>
    unwrap(
      api.GET('/poses', {
        params: { header: doAluno(quem).header, query: { ativa: 'true' } },
      }),
    ).then((lista) => lista.data),

  /** Passo 1: URL assinada (vale 10 min). Sem dataRegistro, a API usa hoje (horário de Brasília). */
  criarEnvio: async (
    quem: Identificacao,
    dados: { poseId: string; tipoArquivo: 'image/jpeg'; tamanho: number },
  ): Promise<Envio> =>
    unwrap(api.POST('/alunos/{alunoId}/fotos/envios', { params: doAluno(quem), body: dados })),

  /** Passo 2: depois do PUT no storage, confirma com o objeto "confirmacao" do passo 1. */
  confirmarEnvio: async (quem: Identificacao, confirmacao: Envio['confirmacao']): Promise<Foto> =>
    unwrap(api.POST('/alunos/{alunoId}/fotos', { params: doAluno(quem), body: confirmacao })),

  /** Fotos por dia (mais recentes primeiro) e, dentro do dia, pela ordem das poses. */
  galeria: async (quem: Identificacao, page: number): Promise<PaginaGaleria> => {
    const { data, meta } = await unwrap(
      api.GET('/alunos/{alunoId}/fotos', {
        params: { ...doAluno(quem), query: { page, pageSize: DIAS_POR_PAGINA } },
      }),
    );
    return { dias: data, temMais: meta.page < meta.totalPages };
  },

  /** Uma linha por pose com a foto de cada data (null = sem foto daquela pose na data). */
  comparar: async (
    quem: Identificacao,
    datas: { antes: string; depois: string },
  ): Promise<Comparacao> => {
    const resposta = await unwrap(
      api.GET('/alunos/{alunoId}/fotos/comparar', {
        params: { ...doAluno(quem), query: datas },
      }),
    );
    // Ver o comentário de Comparacao (tipo gerado incorreto para o null).
    return resposta as unknown as Comparacao;
  },
};

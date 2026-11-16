import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components, paths } from '../../api/generated/schema';

/**
 * Chamadas à API do motor de questionários (BE-QST-01..04) e do histórico de respostas
 * (BE-RSP-04), tipadas pelo contrato OpenAPI. As telas usam só estas funções;
 * qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Modelo = Schemas['ModeloQuestionario'];
export type ModeloResumo = Schemas['ModeloQuestionarioResumo'];
export type Pergunta = Schemas['Pergunta'];
export type PerguntaEntrada = Schemas['PerguntaEntrada'];
export type CriarModelo = Schemas['CriarModeloQuestionario'];
export type EditarModelo = Schemas['EditarModeloQuestionario'];
export type TipoModelo = Modelo['tipo'];
export type TipoPergunta = Pergunta['tipo'];
export type SexoAlvo = Modelo['sexoAlvo'];
export type Submissao = Schemas['Submissao'];
export type SubmissaoResumo = Schemas['SubmissaoResumo'];
export type PerguntaRespondida = Schemas['PerguntaRespondida'];

interface Paginada<T> {
  data: T[];
  meta: Schemas['PaginationMeta'];
}

export type ListaModelos = Paginada<ModeloResumo>;
export type ListaSubmissoes = Paginada<SubmissaoResumo>;

export interface FiltrosModelos {
  q?: string | undefined;
  tipo?: TipoModelo | undefined;
  ativo?: 'true' | 'false' | undefined;
  page: number;
}

export const MODELOS_POR_PAGINA = 20;
export const ANAMNESES_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

type ListarModelosQuery = NonNullable<paths['/modelos']['get']['parameters']['query']>;

/** Filtro vazio não vai na URL (?q=&tipo= seria recusado pela API). */
function query({ q, tipo, ativo, page }: FiltrosModelos): ListarModelosQuery {
  return {
    page,
    pageSize: MODELOS_POR_PAGINA,
    ...(q && { q }),
    ...(tipo && { tipo }),
    ...(ativo && { ativo }),
  };
}

const porId = (id: string) => ({ params: { header: header(), path: { id } } });

export const modelosApi = {
  listar: async (filtros: FiltrosModelos, signal: AbortSignal): Promise<ListaModelos> =>
    unwrap(api.GET('/modelos', { params: { header: header(), query: query(filtros) }, signal })),

  buscar: async (id: string, signal: AbortSignal): Promise<Modelo> =>
    unwrap(api.GET('/modelos/{id}', { ...porId(id), signal })),

  criar: async (body: CriarModelo): Promise<Modelo> =>
    unwrap(api.POST('/modelos', { params: { header: header() }, body })),

  editar: async (id: string, body: EditarModelo): Promise<Modelo> =>
    unwrap(api.PUT('/modelos/{id}', { ...porId(id), body })),

  /** Sem nome: a cópia se chama "<nome original> (cópia)" (regra do back). */
  duplicar: async (id: string): Promise<Modelo> =>
    unwrap(api.POST('/modelos/{id}/duplicar', porId(id))),

  desativar: async (id: string): Promise<Modelo> =>
    unwrap(api.POST('/modelos/{id}/desativar', porId(id))),

  ativar: async (id: string): Promise<Modelo> =>
    unwrap(api.POST('/modelos/{id}/ativar', porId(id))),
};

export const anamnesesApi = {
  /** Anamneses enviadas pelo aluno, mais recentes primeiro (rascunho não entra). */
  listar: async (alunoId: string, page: number, signal: AbortSignal): Promise<ListaSubmissoes> =>
    unwrap(
      api.GET('/alunos/{alunoId}/submissoes', {
        params: {
          header: header(),
          path: { alunoId },
          query: { tipo: 'anamnese', sort: '-respondidoEm', page, pageSize: ANAMNESES_POR_PAGINA },
        },
        signal,
      }),
    ),

  /** Uma resposta com as perguntas exatamente como estavam na versão respondida. */
  buscar: async (alunoId: string, id: string, signal: AbortSignal): Promise<Submissao> =>
    unwrap(
      api.GET('/alunos/{alunoId}/submissoes/{id}', {
        params: { header: header(), path: { alunoId, id } },
        signal,
      }),
    ),
};

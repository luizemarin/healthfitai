import { api, unwrap } from '../../api/client';
import { config } from '../../config';

import type { components, paths } from '../../api/generated/schema';

/**
 * Chamadas à API da biblioteca de exercícios (BE-EXE-01) usadas no painel (FE-EXE-01),
 * tipadas pelo contrato OpenAPI. Qualquer falha chega como ApiError (ver api/client.ts).
 */
type Schemas = components['schemas'];
export type Exercicio = Schemas['Exercicio'];
export type CriarExercicio = Schemas['CriarExercicio'];
export type EditarExercicio = Schemas['EditarExercicio'];

export interface ListaExercicios {
  data: Exercicio[];
  meta: Schemas['PaginationMeta'];
}

export interface FiltrosExercicios {
  /** Busca no nome e no grupo muscular (regra do back). */
  q?: string | undefined;
  page: number;
}

export const EXERCICIOS_POR_PAGINA = 20;

/** PROVISÓRIO até o login (FE-AUT-01): a API ainda pede o profissional neste header. */
const header = (): { 'x-profissional-id': string } => ({
  'x-profissional-id': config.profissionalId,
});

type ListarExerciciosQuery = NonNullable<paths['/exercicios']['get']['parameters']['query']>;

/** Busca vazia não vai na URL (?q= seria recusado pela API). */
function query({ q, page }: FiltrosExercicios): ListarExerciciosQuery {
  return { page, pageSize: EXERCICIOS_POR_PAGINA, ...(q && { q }) };
}

const porId = (id: string) => ({ params: { header: header(), path: { id } } });

export const exerciciosApi = {
  /** Exercícios da biblioteca, em ordem de nome (os excluídos não aparecem). */
  listar: async (filtros: FiltrosExercicios, signal: AbortSignal): Promise<ListaExercicios> =>
    unwrap(api.GET('/exercicios', { params: { header: header(), query: query(filtros) }, signal })),

  buscar: async (id: string, signal: AbortSignal): Promise<Exercicio> =>
    unwrap(api.GET('/exercicios/{id}', { ...porId(id), signal })),

  criar: async (body: CriarExercicio): Promise<Exercicio> =>
    unwrap(api.POST('/exercicios', { params: { header: header() }, body })),

  editar: async (id: string, body: EditarExercicio): Promise<Exercicio> =>
    unwrap(api.PATCH('/exercicios/{id}', { ...porId(id), body })),

  /** Exclusão lógica: some da biblioteca, mas os treinos que já usam continuam íntegros. */
  excluir: async (id: string): Promise<void> =>
    unwrap(api.DELETE('/exercicios/{id}', porId(id))).then(() => undefined),
};

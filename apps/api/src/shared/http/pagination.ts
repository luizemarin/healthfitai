import { z } from 'zod';

/**
 * Convenção de listagem (query string):
 *   ?page=1&pageSize=20     → paginação (page ≥ 1; pageSize 1..100, padrão 20)
 *   ?sort=name | -createdAt → ordenação por campo permitido; "-" = decrescente
 *   ?q=texto                → busca textual livre (o módulo decide em quais campos)
 *   ?<campo>=valor          → filtros específicos, declarados pelo módulo com o mesmo nome do campo
 * Resposta: { data: [...], meta: { page, pageSize, totalItems, totalPages } }
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).meta({ description: 'Página (começa em 1).' }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .meta({ description: `Itens por página (máx. ${MAX_PAGE_SIZE}).` }),
});

export type PaginationQuery = z.output<typeof paginationQuerySchema>;

export interface SortOrder<F extends string> {
  field: F;
  direction: 'asc' | 'desc';
}

type SortSchema<F extends string> = z.ZodType<SortOrder<F>, string | undefined>;
type QuerySchema = z.ZodType<string | undefined, string | undefined>;

export type ListQuerySchema<F extends string, S extends z.ZodRawShape> = z.ZodObject<
  typeof paginationQuerySchema.shape & { sort: SortSchema<F>; q: QuerySchema } & S
>;

/** Filtro booleano em query string: aceita apenas "true" ou "false". */
export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

interface ListQueryOptions<F extends string, S extends z.ZodRawShape> {
  /** Campos pelos quais o cliente pode ordenar. */
  sortFields: readonly [F, ...F[]];
  /** Ordenação padrão, no mesmo formato da query (ex.: '-createdAt'). */
  defaultSort: F | `-${F}`;
  /** Filtros específicos do módulo (ex.: { active: booleanQuery.optional() }). */
  filters?: S;
}

/**
 * Monta o schema de query de uma listagem: paginação + sort + q + filtros do módulo.
 *
 *   const listStudentsQuery = listQuerySchema({
 *     sortFields: ['name', 'createdAt'],
 *     defaultSort: 'name',
 *     filters: { active: booleanQuery.optional() },
 *   });
 */
export function listQuerySchema<F extends string, S extends z.ZodRawShape = Record<never, never>>(
  options: ListQueryOptions<F, S>,
): ListQuerySchema<F, S> {
  const allowedSorts = options.sortFields.flatMap((field) => [field, `-${field}`]) as [
    string,
    ...string[],
  ];

  const sort = z
    .enum(allowedSorts)
    .default(options.defaultSort)
    .transform((value): SortOrder<F> =>
      value.startsWith('-')
        ? { field: value.slice(1) as F, direction: 'desc' }
        : { field: value as F, direction: 'asc' },
    )
    .meta({ description: `Ordenação: ${allowedSorts.join(', ')}. "-" = decrescente.` });

  const q = z.string().trim().min(1).max(100).optional().meta({ description: 'Busca textual.' });

  return paginationQuerySchema.extend({
    sort,
    q,
    ...(options.filters ?? ({} as S)),
  });
}

export const paginationMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'PaginationMeta' });

export type PaginationMeta = z.output<typeof paginationMetaSchema>;

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Schema de resposta paginada para o contrato OpenAPI. */
export function paginatedResponseSchema<T extends z.ZodType>(
  itemSchema: T,
): z.ZodObject<{ data: z.ZodArray<T>; meta: typeof paginationMetaSchema }> {
  return z.object({ data: z.array(itemSchema), meta: paginationMetaSchema });
}

/** Converte page/pageSize em offset/limit (formato skip/take do Prisma). */
export function toSkipTake({ page, pageSize }: PaginationQuery): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Monta a resposta paginada a partir da página de itens e do total. */
export function paginate<T>(
  data: T[],
  totalItems: number,
  { page, pageSize }: PaginationQuery,
): Paginated<T> {
  return {
    data,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

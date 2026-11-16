import { z } from 'zod';

import { listQuerySchema, paginatedResponseSchema } from '../../shared/http/pagination';

/**
 * Schemas Zod do módulo de exercícios: validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única). Campos em português, iguais às colunas da
 * tabela exercicios (DB-022).
 */

// ─── Campos ─────────────────────────────────────────────────────────────────

const nome = z
  .string({ error: 'O nome do exercício é obrigatório.' })
  .trim()
  .min(2, 'O nome do exercício deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome do exercício deve ter no máximo 120 caracteres.')
  .meta({ example: 'Agachamento livre' });

/** Texto livre por enquanto (a lista de grupos ainda não está fechada, ver DB-022). */
const grupoMuscular = z
  .string({ error: 'O grupo muscular é obrigatório.' })
  .trim()
  .min(1, 'O grupo muscular é obrigatório.')
  .max(60, 'O grupo muscular deve ter no máximo 60 caracteres.')
  .meta({ example: 'Pernas' });

/** Texto vazio vira null: no banco "sem valor" é sempre NULL, nunca "" (CHECK). */
const vazioViraNull = (valor: string): string | null => (valor === '' ? null : valor);

const descricao = z
  .string({ error: 'A descrição deve ser um texto.' })
  .trim()
  .max(2000, 'A descrição deve ter no máximo 2000 caracteres.')
  .transform(vazioViraNull)
  .nullable()
  .meta({
    example: 'Pés na largura dos ombros, desça até a coxa ficar paralela ao chão.',
    description: 'Opcional. Envie null (ou "") para deixar sem descrição.',
  });

/** Link de vídeo/imagem de demonstração (ex.: YouTube). Só https, sem espaços. */
const midiaUrl = z
  .string({ error: 'O link da mídia deve ser um texto.' })
  .trim()
  .max(500, 'O link da mídia deve ter no máximo 500 caracteres.')
  .refine(
    (valor) => valor === '' || /^https:\/\/\S+$/.test(valor),
    'O link da mídia deve começar com https:// e não pode ter espaços.',
  )
  .transform(vazioViraNull)
  .nullable()
  .meta({
    example: 'https://www.youtube.com/watch?v=exemplo',
    description: 'Opcional. Envie null (ou "") para remover o link.',
  });

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    return 'Envie os dados do exercício como objeto JSON no corpo da requisição.';
  }
  if (issue.code === 'unrecognized_keys') {
    return `Campo não permitido: ${issue.keys.join(', ')}.`;
  }
  return undefined;
}

// ─── Entrada ────────────────────────────────────────────────────────────────

export const exercicioIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id do exercício deve ser um UUID válido.' }),
});

export const criarExercicioBodySchema = z
  .strictObject(
    {
      nome,
      grupoMuscular,
      descricao: descricao.optional(),
      midiaUrl: midiaUrl.optional(),
    },
    { error: erroCorpo },
  )
  .meta({ id: 'CriarExercicio' });

export const editarExercicioBodySchema = z
  .strictObject(
    {
      nome: nome.optional(),
      grupoMuscular: grupoMuscular.optional(),
      descricao: descricao.optional(),
      midiaUrl: midiaUrl.optional(),
    },
    { error: erroCorpo },
  )
  .refine((body) => Object.values(body).some((valor) => valor !== undefined), {
    message:
      'Envie pelo menos um campo para alterar: "nome", "grupoMuscular", "descricao" ou "midiaUrl".',
  })
  .meta({ id: 'EditarExercicio', description: 'Só os campos enviados são alterados.' });

export const listarExerciciosQuerySchema = listQuerySchema({
  sortFields: ['nome', 'criadoEm'],
  defaultSort: 'nome',
  filters: {
    grupoMuscular: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .optional()
      .meta({ description: 'Só deste grupo muscular (sem diferenciar maiúsculas/acentos).' }),
  },
});

export type CriarExercicioBody = z.output<typeof criarExercicioBodySchema>;
export type EditarExercicioBody = z.output<typeof editarExercicioBodySchema>;
export type ListarExerciciosQuery = z.output<typeof listarExerciciosQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

export const exercicioResponseSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    grupoMuscular: z.string(),
    descricao: z.string().nullable(),
    midiaUrl: z.string().nullable(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'Exercicio' });

export const listaExerciciosResponseSchema = paginatedResponseSchema(exercicioResponseSchema);

export type ExercicioResponse = z.output<typeof exercicioResponseSchema>;

import { z } from 'zod';

import { listQuerySchema, paginatedResponseSchema } from '../../shared/http/pagination';

/**
 * Schemas Zod do módulo de treinos: validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única). Campos em português, iguais às colunas das
 * tabelas treinos/treino_exercicios (DB-023) e execucoes_treino/series_execucao (DB-024).
 */

// ─── Limites ────────────────────────────────────────────────────────────────

/** BE-TRE-01 · Exercícios por treino (um treino de academia raramente passa de 15). */
export const MAX_EXERCICIOS_POR_TREINO = 30;
export const MAX_SERIES_POR_EXERCICIO = 20;
/** Descanso prescrito ou feito: até 30 minutos. */
export const DESCANSO_MAXIMO_SEGUNDOS = 1800;
/** Barra erro de digitação grosseiro (ex.: 8000 em vez de 80). O banco aceita até 9999.99. */
export const CARGA_MAXIMA_KG = 1000;

/** BE-TRE-02 · Duração máxima de uma execução: 6 horas. */
export const DURACAO_MAXIMA_SEGUNDOS = 6 * 60 * 60;
export const MAX_SERIES_POR_EXECUCAO = MAX_EXERCICIOS_POR_TREINO * MAX_SERIES_POR_EXERCICIO;
export const MAX_REPETICOES = 1000;

const EXEMPLO_DATA_HORA = '2026-11-11T07:30:00-03:00';

/** No máximo 2 casas decimais (as colunas são DECIMAL(6,2)). */
function ateDuasCasas(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(oQue: string) {
  return (issue: z.core.$ZodRawIssue): string | undefined => {
    if (issue.code === 'invalid_type') {
      return `Envie ${oQue} como objeto JSON no corpo da requisição.`;
    }
    if (issue.code === 'unrecognized_keys') {
      return `Campo não permitido: ${issue.keys.join(', ')}.`;
    }
    return undefined;
  };
}

/** Número inteiro com mensagens em português para ausente, não inteiro e fora da faixa. */
function inteiro(campo: string, min: number, max: number, exemplo: number) {
  return z
    .number({ error: `Informe "${campo}" como número inteiro (ex.: ${exemplo}).` })
    .int(`"${campo}" deve ser um número inteiro.`)
    .min(min, `"${campo}" deve ser no mínimo ${min}.`)
    .max(max, `"${campo}" deve ser no máximo ${max}.`)
    .meta({ example: exemplo });
}

/** Carga em kg: opcional, null = sem carga (ex.: peso do corpo). */
const cargaKg = z
  .number({ error: 'A "cargaKg" deve ser um número em quilos (ex.: 40.5) ou null, sem carga.' })
  .min(0, 'A "cargaKg" não pode ser negativa.')
  .max(CARGA_MAXIMA_KG, `A "cargaKg" deve ser de no máximo ${CARGA_MAXIMA_KG} kg.`)
  .refine(ateDuasCasas, 'A "cargaKg" aceita no máximo 2 casas decimais (ex.: 42.5).')
  .nullable()
  .meta({ example: 40, description: 'Opcional. null = sem carga (ex.: peso do corpo).' });

const exercicioId = z
  .uuid({ error: 'O "exercicioId" deve ser o id (UUID) de um exercício da sua biblioteca.' })
  .meta({ description: 'Exercício da biblioteca (BE-EXE-01).' });

// ─── Entrada: treinos (BE-TRE-01) ───────────────────────────────────────────

const nomeTreino = z
  .string({ error: 'O nome do treino é obrigatório.' })
  .trim()
  .min(1, 'O nome do treino é obrigatório.')
  .max(120, 'O nome do treino deve ter no máximo 120 caracteres.')
  .meta({ example: 'Treino A · Pernas' });

const itemTreinoSchema = z
  .strictObject(
    {
      exercicioId,
      series: inteiro('series', 1, MAX_SERIES_POR_EXERCICIO, 4),
      repeticoes: z
        .string({ error: 'Informe "repeticoes" como texto (ex.: "12", "8-12" ou "até a falha").' })
        .trim()
        .min(1, 'Informe as repetições (ex.: "12", "8-12" ou "até a falha").')
        .max(20, 'As repetições devem ter no máximo 20 caracteres.')
        .meta({ example: '8-12' }),
      descansoSegundos: inteiro('descansoSegundos', 0, DESCANSO_MAXIMO_SEGUNDOS, 90).meta({
        description: 'Descanso entre as séries, em segundos. 0 = sem descanso.',
      }),
      cargaKg: cargaKg.optional(),
    },
    { error: erroCorpo('cada exercício do treino') },
  )
  .meta({ id: 'ItemTreinoEntrada' });

/** A ordem do treino é a ordem da lista. Um exercício aparece uma vez só por treino. */
const exerciciosDoTreino = z
  .array(itemTreinoSchema, {
    error:
      'Envie "exercicios" como uma lista de { exercicioId, series, repeticoes, descansoSegundos, cargaKg }.',
  })
  .min(1, 'O treino precisa de pelo menos um exercício.')
  .max(
    MAX_EXERCICIOS_POR_TREINO,
    `O treino pode ter no máximo ${MAX_EXERCICIOS_POR_TREINO} exercícios.`,
  )
  .refine(
    (itens) => new Set(itens.map((item) => item.exercicioId)).size === itens.length,
    'Um exercício não pode aparecer mais de uma vez no mesmo treino. Aumente as séries dele.',
  )
  .meta({ description: 'Na ordem em que devem ser feitos.' });

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const treinoIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id do treino deve ser um UUID válido.' }),
});

export const criarTreinoBodySchema = z
  .strictObject(
    { nome: nomeTreino, exercicios: exerciciosDoTreino },
    { error: erroCorpo('os dados do treino') },
  )
  .meta({ id: 'CriarTreino' });

export const editarTreinoBodySchema = z
  .strictObject(
    { nome: nomeTreino.optional(), exercicios: exerciciosDoTreino.optional() },
    { error: erroCorpo('os dados do treino') },
  )
  .refine((body) => body.nome !== undefined || body.exercicios !== undefined, {
    message: 'Envie pelo menos um campo para alterar: "nome" ou "exercicios".',
  })
  .meta({
    id: 'EditarTreino',
    description: 'Só os campos enviados mudam. "exercicios" substitui a lista inteira.',
  });

/** Corpo opcional: sem nada, copia para o mesmo aluno com o nome "<nome> (cópia)". */
export const duplicarTreinoBodySchema = z
  .strictObject(
    {
      nome: nomeTreino.optional().meta({ description: 'Sem o campo: "<nome original> (cópia)".' }),
      alunoId: z
        .uuid({ error: 'O "alunoId" deve ser o id (UUID) de um aluno seu.' })
        .optional()
        .meta({ description: 'Copiar para outro aluno. Sem o campo: o mesmo aluno.' }),
    },
    { error: erroCorpo('os dados da cópia') },
  )
  .optional()
  .meta({ id: 'DuplicarTreino' });

export const listarTreinosQuerySchema = listQuerySchema({
  sortFields: ['nome', 'criadoEm'],
  defaultSort: 'nome',
});

export type ItemTreinoBody = z.output<typeof itemTreinoSchema>;
export type CriarTreinoBody = z.output<typeof criarTreinoBodySchema>;
export type EditarTreinoBody = z.output<typeof editarTreinoBodySchema>;
export type DuplicarTreinoBody = z.output<typeof duplicarTreinoBodySchema>;
export type ListarTreinosQuery = z.output<typeof listarTreinosQuerySchema>;

// ─── Entrada: execução (BE-TRE-02) ──────────────────────────────────────────

const serieExecucaoSchema = z.strictObject(
  {
    exercicioId,
    serie: inteiro('serie', 1, MAX_SERIES_POR_EXERCICIO, 1).meta({
      description: 'Nº da série deste exercício: 1, 2, 3...',
    }),
    repeticoes: inteiro('repeticoes', 0, MAX_REPETICOES, 10).meta({
      description: 'Repetições feitas de verdade.',
    }),
    cargaKg: cargaKg.optional(),
    descansoSegundos: inteiro('descansoSegundos', 0, DESCANSO_MAXIMO_SEGUNDOS, 85)
      .nullable()
      .optional()
      .meta({ description: 'Descanso feito DEPOIS desta série. null/ausente = não medido.' }),
  },
  { error: erroCorpo('cada série') },
);

export const execucaoIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id da execução deve ser um UUID válido.' }),
});

export const treinoParamsSchema = z.object({
  treinoId: z.uuid({ error: 'O id do treino deve ser um UUID válido.' }),
});

export const finalizarExecucaoBodySchema = z
  .strictObject(
    {
      iniciadoEm: z.iso
        .datetime({
          offset: true,
          error: (issue) =>
            issue.input === undefined
              ? `Informe "iniciadoEm" (data e hora ISO 8601 com fuso, ex.: ${EXEMPLO_DATA_HORA}).`
              : `"iniciadoEm" deve ser data e hora ISO 8601 com fuso (ex.: ${EXEMPLO_DATA_HORA}).`,
        })
        .meta({ example: EXEMPLO_DATA_HORA, description: 'Quando o aluno começou o treino.' }),
      duracaoSegundos: inteiro('duracaoSegundos', 1, DURACAO_MAXIMA_SEGUNDOS, 3600).meta({
        description: 'Tempo total do treino (timer do app), em segundos.',
      }),
      series: z
        .array(serieExecucaoSchema, {
          error:
            'Envie "series" como uma lista de { exercicioId, serie, repeticoes, cargaKg, descansoSegundos }.',
        })
        .min(1, 'Registre pelo menos uma série feita antes de finalizar o treino.')
        .max(MAX_SERIES_POR_EXECUCAO, `Envie no máximo ${MAX_SERIES_POR_EXECUCAO} séries.`)
        .refine(
          (series) =>
            new Set(series.map((item) => `${item.exercicioId}#${String(item.serie)}`)).size ===
            series.length,
          'A mesma série de um exercício foi enviada mais de uma vez (confira o "serie").',
        ),
    },
    { error: erroCorpo('os dados do treino feito') },
  )
  .meta({ id: 'FinalizarExecucaoTreino' });

export type FinalizarExecucaoBody = z.output<typeof finalizarExecucaoBodySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

const exercicioResumoSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    grupoMuscular: z.string(),
    ativo: z.boolean().meta({ description: 'false = excluído da biblioteca depois.' }),
  })
  .meta({ id: 'ExercicioResumo' });

export const treinoResponseSchema = z
  .object({
    id: z.uuid(),
    alunoId: z.uuid(),
    nome: z.string(),
    exercicios: z.array(
      z.object({
        id: z.uuid(),
        ordem: z.number().int(),
        exercicio: exercicioResumoSchema,
        series: z.number().int(),
        repeticoes: z.string(),
        descansoSegundos: z.number().int(),
        cargaKg: z.number().nullable(),
      }),
    ),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'Treino' });

export const listaTreinosResponseSchema = paginatedResponseSchema(treinoResponseSchema);

export const execucaoResponseSchema = z
  .object({
    id: z.uuid(),
    alunoId: z.uuid(),
    treinoId: z.uuid(),
    iniciadoEm: z.iso.datetime(),
    finalizadoEm: z.iso.datetime().meta({ description: 'iniciadoEm + duracaoSegundos.' }),
    duracaoSegundos: z.number().int(),
    series: z.array(
      z.object({
        id: z.uuid(),
        exercicio: exercicioResumoSchema,
        serie: z.number().int(),
        repeticoes: z.number().int(),
        cargaKg: z.number().nullable(),
        descansoSegundos: z.number().int().nullable(),
      }),
    ),
    criadoEm: z.iso.datetime(),
  })
  .meta({ id: 'ExecucaoTreino' });

export type ExercicioResumo = z.output<typeof exercicioResumoSchema>;
export type TreinoResponse = z.output<typeof treinoResponseSchema>;
export type ExecucaoResponse = z.output<typeof execucaoResponseSchema>;

import { z } from 'zod';

import { DIAS_PERIODO_MAXIMO, DIAS_PERIODO_PADRAO, hojeEmBrasilia } from './dashboard.periodo';
import {
  booleanQuery,
  listQuerySchema,
  paginatedResponseSchema,
} from '../../shared/http/pagination';

/**
 * Schemas Zod do painel (BE-DSH-01): validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única).
 */

// ─── Entrada ────────────────────────────────────────────────────────────────

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

const dataFiltro = (campo: string, descricao: string) =>
  z.iso
    // abort: data mal formatada não chega na regra do "futuro" (uma mensagem só por campo).
    .date({ error: `A data "${campo}" deve estar no formato AAAA-MM-DD.`, abort: true })
    .refine((data) => data <= hojeEmBrasilia(), `A data "${campo}" não pode ser no futuro.`)
    .optional()
    .meta({ description: descricao });

const PERIODO_PADRAO = `Sem "de" e "ate": últimos ${DIAS_PERIODO_PADRAO} dias. Máximo de ${DIAS_PERIODO_MAXIMO} dias.`;

/** Filtro de período comum às duas rotas. */
const periodoShape = {
  de: dataFiltro(
    'de',
    `Desde esta data (inclusive). Sem ela: ${DIAS_PERIODO_PADRAO} dias antes de "ate". ${PERIODO_PADRAO}`,
  ),
  ate: dataFiltro('ate', `Até esta data (inclusive). Sem ela: hoje. ${PERIODO_PADRAO}`),
};

const dePrecedeAte = (query: { de?: string | undefined; ate?: string | undefined }): boolean =>
  !query.de || !query.ate || query.de <= query.ate;

const ERRO_ORDEM = {
  message: 'A data "de" deve ser anterior ou igual à data "ate".',
  path: ['ate'],
};

export const periodoQuerySchema = z.object(periodoShape).refine(dePrecedeAte, ERRO_ORDEM);

export const listarDashboardQuerySchema = listQuerySchema({
  sortFields: ['nome', 'treinos', 'ultimoTreinoEm'],
  defaultSort: 'nome',
  filters: {
    ...periodoShape,
    ativo: booleanQuery.default(true).meta({
      description: 'Situação do aluno (true/false). Padrão: true (só alunos ativos).',
    }),
  },
}).refine(dePrecedeAte, ERRO_ORDEM);

export type PeriodoQuery = z.output<typeof periodoQuerySchema>;
export type ListarDashboardQuery = z.output<typeof listarDashboardQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

const periodoResponseSchema = z
  .object({
    de: z.iso.date(),
    ate: z.iso.date(),
    dias: z.number().int().meta({ description: 'Quantidade de dias do período.', example: 30 }),
  })
  .meta({ id: 'DashboardPeriodo', description: 'Período usado, já com os padrões aplicados.' });

const alunoResumoSchema = z
  .object({ id: z.uuid(), nome: z.string(), ativo: z.boolean() })
  .meta({ id: 'DashboardAlunoResumo' });

/** Mesmos campos na visão consolidada e no detalhe do aluno. */
const frequenciaShape = {
  treinos: z.number().int().meta({ description: 'Treinos finalizados no período.', example: 12 }),
  diasTreinados: z.number().int().meta({
    description: 'Dias distintos com treino no período (2 treinos no mesmo dia = 1 dia).',
    example: 11,
  }),
  mediaSemanal: z
    .number()
    .meta({ description: 'Treinos por semana no período (1 casa decimal).', example: 2.8 }),
  ultimoTreinoEm: z.iso.datetime().nullable().meta({
    description:
      'Início do último treino, em qualquer data (não depende do período). Nulo = nunca treinou.',
  }),
  diasSemTreinar: z.number().int().nullable().meta({
    description: 'Dias desde o último treino até hoje (0 = treinou hoje). Nulo = nunca treinou.',
    example: 2,
  }),
};

const frequenciaSchema = z.object(frequenciaShape).meta({ id: 'DashboardFrequencia' });

const semanaSchema = z
  .object({
    inicio: z.iso.date().meta({ description: 'Segunda-feira (ou o início do período).' }),
    fim: z.iso.date().meta({ description: 'Domingo (ou o fim do período).' }),
    treinos: z.number().int(),
  })
  .meta({ id: 'DashboardSemana' });

const progressaoCargaSchema = z
  .object({
    exercicio: z.object({
      id: z.uuid(),
      nome: z.string(),
      grupoMuscular: z.string(),
      ativo: z.boolean().meta({ description: 'false = excluído da biblioteca depois.' }),
    }),
    pontos: z
      .array(
        z.object({
          data: z.iso.date().meta({ description: 'Dia do treino (horário de Brasília).' }),
          cargaMaximaKg: z.number().meta({ description: 'Maior carga do dia.', example: 40 }),
        }),
      )
      .meta({ description: 'Um ponto por dia com carga, em ordem de data crescente.' }),
    cargaInicialKg: z.number().meta({ description: 'Primeiro ponto do período.', example: 30 }),
    cargaAtualKg: z.number().meta({ description: 'Último ponto do período.', example: 40 }),
    variacaoKg: z.number().meta({ description: 'Atual − inicial.', example: 10 }),
    variacaoPercentual: z.number().nullable().meta({
      description:
        '(Atual − inicial) / inicial × 100, 1 casa decimal. Nulo se a carga inicial for 0.',
      example: 33.3,
    }),
  })
  .meta({ id: 'DashboardProgressaoCarga' });

export const dashboardAlunoItemSchema = z
  .object({ aluno: alunoResumoSchema, frequencia: frequenciaSchema })
  .meta({ id: 'DashboardAlunoItem' });

export const listaDashboardResponseSchema = paginatedResponseSchema(dashboardAlunoItemSchema)
  .extend({ periodo: periodoResponseSchema })
  .meta({ id: 'DashboardAlunos' });

export const dashboardAlunoResponseSchema = z
  .object({
    periodo: periodoResponseSchema,
    aluno: alunoResumoSchema,
    frequencia: z.object({
      ...frequenciaShape,
      semanas: z.array(semanaSchema).meta({
        description: 'Treinos por semana, todas as semanas do período (inclusive com 0).',
      }),
    }),
    progressaoCarga: z.array(progressaoCargaSchema).meta({
      description:
        'Uma entrada por exercício com carga registrada no período, por nome. Séries sem carga não entram.',
    }),
  })
  .meta({ id: 'DashboardAluno' });

export type DashboardAlunoItemResponse = z.output<typeof dashboardAlunoItemSchema>;
export type ListaDashboardResponse = z.output<typeof listaDashboardResponseSchema>;
export type DashboardAlunoResponse = z.output<typeof dashboardAlunoResponseSchema>;

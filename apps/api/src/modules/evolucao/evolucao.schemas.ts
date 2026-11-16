import { z } from 'zod';

import { UNIDADES } from '../medidas/medidas.schemas';
import { TIPOS_MODELO } from '../questionarios/questionarios.schemas';

/**
 * Schemas Zod da evolução (BE-EVO-01): validam a entrada no controller e geram
 * o contrato OpenAPI (fonte única).
 */

/** Tipos de pergunta que podem virar curva (BE-QST-03: só numero e escala). */
export const TIPOS_PERGUNTA_EVOLUCAO = ['numero', 'escala'] as const;

// ─── Entrada ────────────────────────────────────────────────────────────────

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

const dataFiltro = (campo: string) =>
  z.iso.date({ error: `A data "${campo}" deve estar no formato AAAA-MM-DD.` });

export const evolucaoQuerySchema = z
  .object({
    de: dataFiltro('de').optional().meta({
      description: 'Desde esta data (inclusive). Sem o filtro, desde o primeiro registro.',
    }),
    ate: dataFiltro('ate')
      .optional()
      .meta({ description: 'Até esta data (inclusive). Sem o filtro, até o último registro.' }),
  })
  .refine((query) => !query.de || !query.ate || query.de <= query.ate, {
    message: 'A data "de" deve ser anterior ou igual à data "ate".',
    path: ['ate'],
  });

export type EvolucaoQuery = z.output<typeof evolucaoQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

const pontoSchema = z
  .object({
    data: z.iso.date().meta({ description: 'Dia do valor (AAAA-MM-DD, horário de Brasília).' }),
    valor: z.number().meta({ example: 72.35 }),
  })
  .meta({ id: 'PontoEvolucao' });

const pontoPerguntaSchema = pontoSchema
  .extend({
    submissaoId: z.uuid().meta({ description: 'Questionário respondido de onde veio o valor.' }),
  })
  .meta({ id: 'PontoEvolucaoPergunta' });

const seriePesoSchema = z
  .object({
    unidade: z.literal('kg'),
    pontos: z.array(pontoSchema).meta({ description: 'Vazio se não houver pesagens no período.' }),
  })
  .meta({ id: 'SerieEvolucaoPeso' });

const serieMedidaSchema = z
  .object({
    tipo: z.object({
      id: z.uuid(),
      nome: z.string(),
      unidade: z.enum(UNIDADES),
      ativo: z.boolean(),
    }),
    pontos: z.array(pontoSchema),
  })
  .meta({ id: 'SerieEvolucaoMedida' });

const seriePerguntaSchema = z
  .object({
    perguntaId: z.uuid().meta({
      description:
        'Id da pergunta na versão mais recente respondida. Use como chave da curva no front.',
    }),
    modelo: z.object({ id: z.uuid(), nome: z.string(), tipo: z.enum(TIPOS_MODELO) }),
    enunciado: z.string(),
    tipo: z.enum(TIPOS_PERGUNTA_EVOLUCAO),
    unidade: z.string().nullable(),
    min: z.number().nullable().meta({ description: 'Ajuda a fixar o eixo Y (escala).' }),
    max: z.number().nullable(),
    pontos: z.array(pontoPerguntaSchema),
  })
  .meta({ id: 'SerieEvolucaoPergunta' });

export const evolucaoResponseSchema = z
  .object({
    periodo: z.object({
      de: z.iso.date().nullable(),
      ate: z.iso.date().nullable(),
    }),
    peso: seriePesoSchema,
    medidas: z
      .array(serieMedidaSchema)
      .meta({ description: 'Só tipos com registro no período, por nome.' }),
    perguntas: z
      .array(seriePerguntaSchema)
      .meta({ description: 'Só perguntas com resposta no período, por modelo e enunciado.' }),
  })
  .meta({ id: 'Evolucao' });

export type EvolucaoResponse = z.output<typeof evolucaoResponseSchema>;

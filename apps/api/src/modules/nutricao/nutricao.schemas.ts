import { z } from 'zod';

import {
  booleanQuery,
  listQuerySchema,
  paginatedResponseSchema,
} from '../../shared/http/pagination';

/**
 * Schemas Zod do módulo de nutrição: validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única). Campos em português, iguais às colunas das
 * tabelas planos_nutricionais/planos_nutricionais_itens (DB-025).
 */

// ─── Limites ────────────────────────────────────────────────────────────────

/** Refeições por plano (um plano costuma ter de 4 a 8). */
export const MAX_REFEICOES_POR_PLANO = 15;
export const NOME_MAXIMO = 120;
export const REFEICAO_MAXIMA = 60;
export const TEXTO_MAXIMO = 2000;

/** "HH:MM" de 00:00 a 23:59 (a coluna é TIME(0), sem segundos). */
const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/**
 * Texto obrigatório: sem espaços nas pontas, não vazio e com tamanho máximo.
 * `campo` com o artigo, para a frase sair certa: "o nome do plano", "a descrição".
 */
function textoObrigatorio(campo: string, max: number, exemplo: string) {
  const inicio = campo.charAt(0).toUpperCase() + campo.slice(1);
  return z
    .string({ error: `Informe ${campo}.` })
    .trim()
    .min(1, `Informe ${campo}.`)
    .max(max, `${inicio} deve ter no máximo ${String(max)} caracteres.`)
    .meta({ example: exemplo });
}

// ─── Entrada (BE-NUT-01) ────────────────────────────────────────────────────

const nomePlano = textoObrigatorio('o nome do plano', NOME_MAXIMO, 'Plano cutting · nov/26');

/** Opcional. Texto vazio vira null (o banco não aceita ""). null = apagar a observação. */
const observacoes = z
  .string({ error: 'As "observacoes" devem ser um texto ou null.' })
  .trim()
  .max(TEXTO_MAXIMO, `As observações devem ter no máximo ${String(TEXTO_MAXIMO)} caracteres.`)
  .nullable()
  .transform((valor) => (valor === '' ? null : valor))
  .meta({
    example: 'Beber 3 L de água por dia. Evitar frituras.',
    description: 'Opcional. Vazio ou null = sem observação.',
  });

const refeicaoSchema = z
  .strictObject(
    {
      refeicao: textoObrigatorio('o nome da refeição', REFEICAO_MAXIMA, 'Café da manhã'),
      horario: z
        .string({ error: 'O "horario" deve ser um texto no formato HH:MM (ex.: "07:30") ou null.' })
        .trim()
        .regex(
          HORARIO_REGEX,
          'O "horario" deve estar no formato HH:MM, de 00:00 a 23:59 (ex.: "07:30").',
        )
        .nullable()
        .optional()
        .meta({
          example: '07:30',
          description: 'Horário sugerido. Opcional (null = sem horário).',
        }),
      descricao: textoObrigatorio(
        'a descrição da refeição',
        TEXTO_MAXIMO,
        '2 ovos mexidos, 1 pão integral e 1 fruta',
      ).meta({ description: 'Alimentos e quantidades, em texto livre.' }),
    },
    { error: erroCorpo('cada refeição do plano') },
  )
  .meta({ id: 'RefeicaoPlanoEntrada' });

/** A ordem do plano é a ordem da lista. */
const refeicoesDoPlano = z
  .array(refeicaoSchema, {
    error: 'Envie "refeicoes" como uma lista de { refeicao, horario, descricao }.',
  })
  .min(1, 'O plano precisa de pelo menos uma refeição.')
  .max(
    MAX_REFEICOES_POR_PLANO,
    `O plano pode ter no máximo ${String(MAX_REFEICOES_POR_PLANO)} refeições.`,
  )
  .meta({ description: 'Na ordem do dia (a posição na lista é a ordem).' });

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const planoIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id do plano nutricional deve ser um UUID válido.' }),
});

export const criarPlanoBodySchema = z
  .strictObject(
    { nome: nomePlano, observacoes: observacoes.optional(), refeicoes: refeicoesDoPlano },
    { error: erroCorpo('os dados do plano nutricional') },
  )
  .meta({ id: 'CriarPlanoNutricional' });

export const editarPlanoBodySchema = z
  .strictObject(
    {
      nome: nomePlano.optional(),
      observacoes: observacoes.optional(),
      refeicoes: refeicoesDoPlano.optional(),
    },
    { error: erroCorpo('os dados do plano nutricional') },
  )
  .refine(
    (body) =>
      body.nome !== undefined || body.observacoes !== undefined || body.refeicoes !== undefined,
    { message: 'Envie pelo menos um campo para alterar: "nome", "observacoes" ou "refeicoes".' },
  )
  .meta({
    id: 'EditarPlanoNutricional',
    description: 'Só os campos enviados mudam. "refeicoes" substitui a lista inteira.',
  });

export const listarPlanosQuerySchema = listQuerySchema({
  sortFields: ['criadoEm', 'nome'],
  defaultSort: '-criadoEm',
  filters: {
    ativo: booleanQuery.optional().meta({
      description: 'true = só o plano em uso; false = só os antigos. Sem o filtro: todos.',
    }),
  },
});

export type RefeicaoBody = z.output<typeof refeicaoSchema>;
export type CriarPlanoBody = z.output<typeof criarPlanoBodySchema>;
export type EditarPlanoBody = z.output<typeof editarPlanoBodySchema>;
export type ListarPlanosQuery = z.output<typeof listarPlanosQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

export const planoResponseSchema = z
  .object({
    id: z.uuid(),
    alunoId: z.uuid(),
    nome: z.string(),
    observacoes: z.string().nullable(),
    ativo: z
      .boolean()
      .meta({ description: 'true = plano em uso. false = substituído ou encerrado.' }),
    refeicoes: z.array(
      z.object({
        id: z.uuid(),
        ordem: z.number().int(),
        refeicao: z.string(),
        horario: z.string().nullable().meta({ example: '07:30' }),
        descricao: z.string(),
      }),
    ),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'PlanoNutricional' });

export const listaPlanosResponseSchema = paginatedResponseSchema(planoResponseSchema);

export type PlanoResponse = z.output<typeof planoResponseSchema>;

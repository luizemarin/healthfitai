import { z } from 'zod';

import {
  booleanQuery,
  listQuerySchema,
  paginatedResponseSchema,
} from '../../shared/http/pagination';
import { SEXOS } from '../alunos/alunos.schemas';

/**
 * Schemas Zod do motor de questionários: validam a entrada no controller e geram
 * o contrato OpenAPI (fonte única). Campos em português, iguais às colunas das
 * tabelas modelos_questionario (DB-007) e perguntas (DB-008).
 */

/** BE-QST-01 · Um motor só serve os três usos. */
export const TIPOS_MODELO = ['anamnese', 'avaliacao', 'feedback'] as const;

/** BE-QST-02 · Tipos de pergunta. */
export const TIPOS_PERGUNTA = [
  'texto_curto',
  'texto_longo',
  'escolha_unica',
  'multipla_escolha',
  'sim_nao',
  'numero',
  'escala',
  'data',
] as const;

const MAX_PERGUNTAS = 100;
const MIN_OPCOES = 2;
const MAX_OPCOES = 30;
/** Limite de DECIMAL(10,2) no banco: 8 dígitos inteiros + 2 casas. */
const LIMITE_NUMERICO = 99_999_999.99;

const MENSAGEM_EVOLUCAO =
  'Só perguntas do tipo "numero" ou "escala" podem aparecer no gráfico de evolução.';

// ─── Campos do modelo ───────────────────────────────────────────────────────

const tipoModelo = z.enum(TIPOS_MODELO, {
  error: 'O tipo do modelo deve ser "anamnese", "avaliacao" ou "feedback".',
});

const nomeModelo = z
  .string({ error: 'O nome do modelo é obrigatório.' })
  .trim()
  .min(2, 'O nome do modelo deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome do modelo deve ter no máximo 120 caracteres.')
  .meta({ example: 'Anamnese inicial' });

/** Para qual sexo o modelo foi feito. null = serve para qualquer aluno. */
const sexoAlvo = z
  .enum(SEXOS, { error: 'O sexo-alvo deve ser "masculino", "feminino" ou null.' })
  .nullable()
  .default(null)
  .meta({ description: 'Para qual sexo o modelo foi feito. null = qualquer aluno.' });

// ─── Campos da pergunta ─────────────────────────────────────────────────────

const enunciado = z
  .string({ error: 'O enunciado da pergunta é obrigatório.' })
  .trim()
  .min(1, 'O enunciado da pergunta é obrigatório.')
  .max(500, 'O enunciado deve ter no máximo 500 caracteres.')
  .meta({ example: 'Qual o seu peso atual?' });

const obrigatoria = z
  .boolean({ error: 'O campo "obrigatoria" deve ser true ou false.' })
  .default(false);

/** BE-QST-03 · Numérica/escala: o profissional decide se entra no gráfico. */
const exibirEvolucao = z
  .boolean({ error: 'O campo "exibirEvolucao" deve ser true ou false.' })
  .default(false)
  .meta({ description: 'A resposta vira série no gráfico de evolução (BE-QST-03).' });

/** BE-QST-03 · Demais tipos: aceita só false (ou ausente), com mensagem clara. */
const semEvolucao = z.literal(false, { error: MENSAGEM_EVOLUCAO }).default(false);

const opcoes = z
  .array(
    z
      .string({ error: 'Cada opção deve ser um texto.' })
      .trim()
      .min(1, 'As opções não podem ser vazias.')
      .max(100, 'Cada opção deve ter no máximo 100 caracteres.'),
    {
      error: (issue) =>
        issue.input === undefined
          ? 'Perguntas de escolha precisam de "opcoes" (lista de textos).'
          : 'Envie as opções como uma lista de textos.',
    },
  )
  .min(MIN_OPCOES, `Informe pelo menos ${MIN_OPCOES} opções.`)
  .max(MAX_OPCOES, `Informe no máximo ${MAX_OPCOES} opções.`)
  .refine(
    (lista) => new Set(lista.map((opcao) => opcao.toLowerCase())).size === lista.length,
    'As opções não podem se repetir.',
  )
  .meta({ example: ['Sedentário', 'Moderado', 'Intenso'] });

const unidade = z
  .string({ error: 'A unidade deve ser um texto.' })
  .trim()
  .min(1, 'A unidade não pode ser vazia. Para não ter unidade, não envie o campo.')
  .max(20, 'A unidade deve ter no máximo 20 caracteres.')
  .meta({ example: 'kg' });

const limite = z
  .number({ error: 'Os limites (min/max) devem ser números.' })
  .min(-LIMITE_NUMERICO, `Os limites devem estar entre -${LIMITE_NUMERICO} e ${LIMITE_NUMERICO}.`)
  .max(LIMITE_NUMERICO, `Os limites devem estar entre -${LIMITE_NUMERICO} e ${LIMITE_NUMERICO}.`)
  .refine(
    (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6,
    'Os limites aceitam no máximo 2 casas decimais.',
  );

const limiteEscala = z
  .number({ error: 'A escala precisa de "min" e "max" numéricos (ex.: 0 a 10).' })
  .int('Os limites da escala devem ser números inteiros (ex.: 0 a 10).')
  .min(-1000, 'Os limites da escala devem estar entre -1000 e 1000.')
  .max(1000, 'Os limites da escala devem estar entre -1000 e 1000.');

function minMenorQueMax(dados: { min?: number | undefined; max?: number | undefined }): boolean {
  return dados.min === undefined || dados.max === undefined || dados.min < dados.max;
}

/** Campo enviado que não existe para aquele tipo de pergunta. */
function erroCamposDoTipo(tipo: string) {
  return (issue: z.core.$ZodRawIssue): string | undefined =>
    issue.code === 'unrecognized_keys'
      ? `Campo não permitido para perguntas do tipo "${tipo}": ${issue.keys.join(', ')}.`
      : undefined;
}

// ─── Pergunta (BE-QST-02): um formato por tipo ──────────────────────────────

const camposBase = { enunciado, obrigatoria };

const perguntaTexto = (tipo: 'texto_curto' | 'texto_longo' | 'sim_nao' | 'data') =>
  z.strictObject(
    { tipo: z.literal(tipo), ...camposBase, exibirEvolucao: semEvolucao },
    { error: erroCamposDoTipo(tipo) },
  );

const perguntaEscolha = (tipo: 'escolha_unica' | 'multipla_escolha') =>
  z.strictObject(
    { tipo: z.literal(tipo), ...camposBase, opcoes, exibirEvolucao: semEvolucao },
    { error: erroCamposDoTipo(tipo) },
  );

const perguntaNumero = z
  .strictObject(
    {
      tipo: z.literal('numero'),
      ...camposBase,
      unidade: unidade.optional(),
      min: limite.optional(),
      max: limite.optional(),
      exibirEvolucao,
    },
    { error: erroCamposDoTipo('numero') },
  )
  .refine(minMenorQueMax, { message: 'O "min" deve ser menor que o "max".', path: ['max'] });

const perguntaEscala = z
  .strictObject(
    {
      tipo: z.literal('escala'),
      ...camposBase,
      unidade: unidade.optional(),
      min: limiteEscala,
      max: limiteEscala,
      exibirEvolucao,
    },
    { error: erroCamposDoTipo('escala') },
  )
  .refine(minMenorQueMax, { message: 'O "min" deve ser menor que o "max".', path: ['max'] });

export const perguntaBodySchema = z
  .discriminatedUnion(
    'tipo',
    [
      perguntaTexto('texto_curto'),
      perguntaTexto('texto_longo'),
      perguntaEscolha('escolha_unica'),
      perguntaEscolha('multipla_escolha'),
      perguntaTexto('sim_nao'),
      perguntaNumero,
      perguntaEscala,
      perguntaTexto('data'),
    ],
    {
      error: (issue) => {
        const { input } = issue;
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
          return 'Cada pergunta deve ser um objeto JSON.';
        }
        return `Tipo de pergunta inválido ou ausente. Use um destes: ${TIPOS_PERGUNTA.join(', ')}.`;
      },
    },
  )
  .meta({ id: 'PerguntaEntrada' });

/** A ordem das perguntas é a posição na lista (1, 2, 3...). */
const perguntas = z
  .array(perguntaBodySchema, { error: 'Envie as perguntas como uma lista.' })
  .min(1, 'O modelo precisa ter pelo menos uma pergunta.')
  .max(MAX_PERGUNTAS, `O modelo pode ter no máximo ${MAX_PERGUNTAS} perguntas.`)
  .meta({ description: 'A ordem no formulário é a posição na lista.' });

// ─── Entrada ────────────────────────────────────────────────────────────────

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    return 'Envie os dados do modelo como objeto JSON no corpo da requisição.';
  }
  if (issue.code === 'unrecognized_keys') {
    if (issue.keys.includes('tipo')) {
      return 'O tipo do modelo não pode ser alterado depois de criado.';
    }
    return `Campo não permitido: ${issue.keys.join(', ')}.`;
  }
  return undefined;
}

export const modeloIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id do modelo deve ser um UUID válido.' }),
});

export const versaoParamsSchema = modeloIdParamsSchema.extend({
  numero: z.coerce
    .number({ error: 'O número da versão deve ser um inteiro a partir de 1.' })
    .int('O número da versão deve ser um inteiro a partir de 1.')
    .min(1, 'O número da versão deve ser um inteiro a partir de 1.'),
});

export const criarModeloBodySchema = z
  .strictObject({ tipo: tipoModelo, nome: nomeModelo, sexoAlvo, perguntas }, { error: erroCorpo })
  .meta({ id: 'CriarModeloQuestionario' });

/**
 * Edição completa (substitui nome, sexo-alvo e perguntas). O tipo não muda.
 * `versao` é a versão que o profissional abriu: se outra edição salvou antes,
 * a API recusa (409) em vez de sobrescrever o trabalho de alguém.
 */
export const editarModeloBodySchema = z
  .strictObject(
    {
      versao: z
        .number({ error: 'Informe a "versao" do modelo que está sendo editado.' })
        .int('A "versao" deve ser um número inteiro.')
        .min(1, 'A "versao" deve ser a partir de 1.')
        .meta({ description: 'Versão que foi aberta para edição (vem do GET).' }),
      nome: nomeModelo,
      sexoAlvo,
      perguntas,
    },
    { error: erroCorpo },
  )
  .meta({ id: 'EditarModeloQuestionario' });

/** Corpo opcional. Sem nome, a cópia se chama "<nome original> (cópia)". */
export const duplicarModeloBodySchema = z
  .strictObject({ nome: nomeModelo.optional() }, { error: erroCorpo })
  .optional()
  .meta({ id: 'DuplicarModeloQuestionario' });

export const listarModelosQuerySchema = listQuerySchema({
  sortFields: ['nome', 'criadoEm', 'atualizadoEm'],
  defaultSort: 'nome',
  filters: {
    tipo: tipoModelo.optional().meta({ description: 'Filtra por tipo.' }),
    ativo: booleanQuery.optional().meta({ description: 'Filtra por situação (true/false).' }),
  },
});

export type PerguntaBody = z.output<typeof perguntaBodySchema>;
export type CriarModeloBody = z.output<typeof criarModeloBodySchema>;
export type EditarModeloBody = z.output<typeof editarModeloBodySchema>;
export type DuplicarModeloBody = z.output<typeof duplicarModeloBodySchema>;
export type ListarModelosQuery = z.output<typeof listarModelosQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

/** Formato único de pergunta na saída; campos que não valem para o tipo vêm null. */
export const perguntaResponseSchema = z
  .object({
    id: z.uuid(),
    ordem: z.number().int(),
    tipo: z.enum(TIPOS_PERGUNTA),
    enunciado: z.string(),
    obrigatoria: z.boolean(),
    exibirEvolucao: z.boolean(),
    opcoes: z
      .array(z.string())
      .nullable()
      .meta({ description: 'Só em escolha_unica/multipla_escolha.' }),
    unidade: z.string().nullable().meta({ description: 'Só em numero/escala.' }),
    min: z.number().nullable().meta({ description: 'Só em numero/escala.' }),
    max: z.number().nullable().meta({ description: 'Só em numero/escala.' }),
  })
  .meta({ id: 'Pergunta' });

const camposResumoModelo = {
  id: z.uuid(),
  tipo: z.enum(TIPOS_MODELO),
  nome: z.string(),
  sexoAlvo: z.enum(SEXOS).nullable(),
  padrao: z.boolean().meta({ description: 'Modelo do sistema: só leitura, pode ser duplicado.' }),
  ativo: z.boolean(),
  versao: z.number().int().meta({ description: 'Versão atual (BE-QST-04).' }),
  totalPerguntas: z.number().int(),
  criadoEm: z.iso.datetime(),
  atualizadoEm: z.iso.datetime(),
};

export const modeloResumoResponseSchema = z
  .object(camposResumoModelo)
  .meta({ id: 'ModeloQuestionarioResumo' });

export const modeloResponseSchema = z
  .object({ ...camposResumoModelo, perguntas: z.array(perguntaResponseSchema) })
  .meta({ id: 'ModeloQuestionario' });

export const listaModelosResponseSchema = paginatedResponseSchema(modeloResumoResponseSchema);

export const versaoResumoResponseSchema = z
  .object({
    numero: z.number().int(),
    totalPerguntas: z.number().int(),
    criadoEm: z.iso.datetime(),
  })
  .meta({ id: 'VersaoModeloResumo' });

export const listaVersoesResponseSchema = z.object({ data: z.array(versaoResumoResponseSchema) });

export const versaoResponseSchema = z
  .object({
    modeloId: z.uuid(),
    numero: z.number().int(),
    criadoEm: z.iso.datetime(),
    perguntas: z.array(perguntaResponseSchema),
  })
  .meta({ id: 'VersaoModelo' });

export type PerguntaResponse = z.output<typeof perguntaResponseSchema>;
export type ModeloResumoResponse = z.output<typeof modeloResumoResponseSchema>;
export type ModeloResponse = z.output<typeof modeloResponseSchema>;
export type VersaoResumoResponse = z.output<typeof versaoResumoResponseSchema>;
export type VersaoResponse = z.output<typeof versaoResponseSchema>;

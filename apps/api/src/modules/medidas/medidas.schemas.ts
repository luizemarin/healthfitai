import { z } from 'zod';

import {
  booleanQuery,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../shared/http/pagination';
import { hojeEmBrasilia } from '../fotos/fotos.schemas';

/**
 * Schemas Zod do módulo de medidas: validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única). Campos em português, iguais às colunas das
 * tabelas registros_peso (DB-016), tipos_medida e registros_medida (DB-017).
 */

/** Quem lançou o registro (tipo "papel" do DB-001). */
export const PAPEIS = ['profissional', 'aluno'] as const;

/**
 * BE-MED-02 · Unidades aceitas. Lista fechada: o front monta o seletor com ela
 * e o gráfico nunca recebe "cm", "CM" e "centímetros" como coisas diferentes.
 */
export const UNIDADES = ['cm', 'mm', '%', 'kg'] as const;

export type Unidade = (typeof UNIDADES)[number];

/** BE-MED-01 · Limites do peso (o banco garante 0 < peso ≤ 500 com CHECK). */
export const PESO_MAXIMO_KG = 500;

/** BE-MED-01 · Teto de uma medida. Barra erro de digitação grosseiro (ex.: 8500 em vez de 85). */
export const VALOR_MAXIMO_MEDIDA = 9999.99;

/** BE-MED-01 · Quantas medidas cabem num lançamento (uma por tipo). */
export const MAX_MEDIDAS_POR_LANCAMENTO = 50;

/** No máximo 2 casas decimais (as colunas são DECIMAL(_, 2)). */
function ateDuasCasas(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

// ─── Campos ─────────────────────────────────────────────────────────────────

const nomeTipo = z
  .string({ error: 'O nome do tipo de medida é obrigatório.' })
  .trim()
  .min(1, 'O nome do tipo de medida é obrigatório.')
  .max(60, 'O nome do tipo de medida deve ter no máximo 60 caracteres.')
  .meta({ example: 'Antebraço direito' });

const unidade = z
  .enum(UNIDADES, { error: `Unidade inválida. Use uma destas: ${UNIDADES.join(', ')}.` })
  .meta({ example: 'cm' });

const tipoId = z.uuid({ error: 'O id do tipo de medida deve ser um UUID válido.' });

/** Dia do registro. Não pode ser no futuro (horário de Brasília). */
const dataRegistro = z.iso
  .date({ error: 'A data do registro deve estar no formato AAAA-MM-DD.' })
  .refine((data) => data <= hojeEmBrasilia(), 'A data do registro não pode ser no futuro.')
  .optional()
  .meta({ description: 'Dia do registro. Sem o campo, vale hoje (horário de Brasília).' });

const dataFiltro = (campo: string) =>
  z.iso.date({ error: `A data "${campo}" deve estar no formato AAAA-MM-DD.` });

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

/** Filtros comuns dos históricos (peso e medidas). */
const filtrosHistorico = {
  sort: z
    .enum(['dataRegistro', '-dataRegistro'], {
      error: 'Ordenação inválida. Use "dataRegistro" ou "-dataRegistro".',
    })
    .default('-dataRegistro')
    .meta({ description: 'Ordem por data. "-" = mais recentes primeiro (padrão).' }),
  de: dataFiltro('de').optional().meta({ description: 'Desde esta data (inclusive).' }),
  ate: dataFiltro('ate').optional().meta({ description: 'Até esta data (inclusive).' }),
};

const periodoValido = {
  check: (query: { de?: string | undefined; ate?: string | undefined }) =>
    !query.de || !query.ate || query.de <= query.ate,
  erro: { message: 'A data "de" deve ser anterior ou igual à data "ate".', path: ['ate'] },
};

// ─── Entrada: tipos de medida (BE-MED-02) ───────────────────────────────────

export const tipoIdParamsSchema = z.object({ id: tipoId });

export const listarTiposQuerySchema = z.object({
  ativo: booleanQuery
    .optional()
    .meta({ description: 'Filtra por situação (true/false). Sem o filtro, vêm todos.' }),
});

export const criarTipoBodySchema = z
  .strictObject({ nome: nomeTipo, unidade }, { error: erroCorpo('os dados do tipo de medida') })
  .meta({ id: 'CriarTipoMedida' });

export const editarTipoBodySchema = z
  .strictObject(
    { nome: nomeTipo.optional(), unidade: unidade.optional() },
    { error: erroCorpo('os dados do tipo de medida') },
  )
  .refine((body) => body.nome !== undefined || body.unidade !== undefined, {
    message: 'Envie pelo menos um campo para alterar: "nome" ou "unidade".',
  })
  .meta({ id: 'EditarTipoMedida', description: 'Só os campos enviados são alterados.' });

// ─── Entrada: registros (BE-MED-01) ─────────────────────────────────────────

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const registrarPesoBodySchema = z
  .strictObject(
    {
      pesoKg: z
        .number({ error: 'Informe o "pesoKg" (peso em quilos, ex.: 72.35).' })
        .positive('O peso deve ser maior que zero.')
        .max(PESO_MAXIMO_KG, `O peso deve ser de no máximo ${PESO_MAXIMO_KG} kg.`)
        .refine(ateDuasCasas, 'O peso aceita no máximo 2 casas decimais (ex.: 72.35).')
        .meta({ example: 72.35 }),
      dataRegistro,
    },
    { error: erroCorpo('os dados do peso') },
  )
  .meta({ id: 'RegistrarPeso' });

const medidaItemSchema = z.strictObject(
  {
    tipoId,
    valor: z
      .number({ error: 'Informe o "valor" da medida (na unidade do tipo).' })
      .positive('O valor da medida deve ser maior que zero.')
      .max(VALOR_MAXIMO_MEDIDA, `O valor da medida deve ser no máximo ${VALOR_MAXIMO_MEDIDA}.`)
      .refine(ateDuasCasas, 'O valor aceita no máximo 2 casas decimais (ex.: 82.5).')
      .meta({ example: 82.5 }),
  },
  { error: erroCorpo('cada medida') },
);

export const registrarMedidasBodySchema = z
  .strictObject(
    {
      dataRegistro,
      medidas: z
        .array(medidaItemSchema, {
          error: 'Envie "medidas" como uma lista de { tipoId, valor }.',
        })
        .min(1, 'Envie pelo menos uma medida.')
        .max(
          MAX_MEDIDAS_POR_LANCAMENTO,
          `Envie no máximo ${MAX_MEDIDAS_POR_LANCAMENTO} medidas por vez.`,
        )
        .refine(
          (medidas) => new Set(medidas.map((m) => m.tipoId)).size === medidas.length,
          'Um tipo de medida não pode aparecer mais de uma vez no mesmo lançamento.',
        )
        .meta({ description: 'Medidas tiradas no mesmo dia, uma por tipo.' }),
    },
    { error: erroCorpo('os dados das medidas') },
  )
  .meta({ id: 'RegistrarMedidas' });

export const listarPesosQuerySchema = paginationQuerySchema
  .extend(filtrosHistorico)
  .refine(periodoValido.check, periodoValido.erro);

export const listarMedidasQuerySchema = paginationQuerySchema
  .extend({
    ...filtrosHistorico,
    tipoId: tipoId.optional().meta({ description: 'Só registros deste tipo (uma curva).' }),
  })
  .refine(periodoValido.check, periodoValido.erro);

export type RegistrarPesoBody = z.output<typeof registrarPesoBodySchema>;
export type RegistrarMedidasBody = z.output<typeof registrarMedidasBodySchema>;
export type EditarTipoBody = z.output<typeof editarTipoBodySchema>;
export type ListarPesosQuery = z.output<typeof listarPesosQuerySchema>;
export type ListarMedidasQuery = z.output<typeof listarMedidasQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

export const tipoMedidaResponseSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    unidade: z.enum(UNIDADES),
    ativo: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'TipoMedida' });

export const listaTiposResponseSchema = z.object({ data: z.array(tipoMedidaResponseSchema) });

export const registroPesoResponseSchema = z
  .object({
    id: z.uuid(),
    pesoKg: z.number().meta({ example: 72.35 }),
    dataRegistro: z.iso.date(),
    registradoPor: z.enum(PAPEIS),
    criadoEm: z.iso.datetime(),
  })
  .meta({ id: 'RegistroPeso' });

export const historicoPesosResponseSchema = paginatedResponseSchema(registroPesoResponseSchema);

export const registroMedidaResponseSchema = z
  .object({
    id: z.uuid(),
    tipo: z.object({
      id: z.uuid(),
      nome: z.string(),
      unidade: z.enum(UNIDADES),
      ativo: z.boolean(),
    }),
    valor: z.number().meta({ example: 82.5, description: 'Na unidade do tipo.' }),
    dataRegistro: z.iso.date(),
    registradoPor: z.enum(PAPEIS),
    criadoEm: z.iso.datetime(),
  })
  .meta({ id: 'RegistroMedida' });

export const listaMedidasRegistradasResponseSchema = z.object({
  data: z.array(registroMedidaResponseSchema),
});

export const historicoMedidasResponseSchema = paginatedResponseSchema(registroMedidaResponseSchema);

export type TipoMedidaResponse = z.output<typeof tipoMedidaResponseSchema>;
export type RegistroPesoResponse = z.output<typeof registroPesoResponseSchema>;
export type RegistroMedidaResponse = z.output<typeof registroMedidaResponseSchema>;

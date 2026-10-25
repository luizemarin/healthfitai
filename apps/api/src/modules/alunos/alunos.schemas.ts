import { z } from 'zod';

import {
  booleanQuery,
  listQuerySchema,
  paginatedResponseSchema,
} from '../../shared/http/pagination';

/**
 * Schemas Zod do módulo: validam a entrada no controller e geram o contrato OpenAPI
 * (fonte única). Campos em português, iguais às colunas da tabela alunos (DB-004).
 */

export const SEXOS = ['masculino', 'feminino'] as const;

const IDADE_MAXIMA = 120;

/** Data de hoje em AAAA-MM-DD. Datas ISO podem ser comparadas como texto. */
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataMinimaNascimento(): string {
  const data = new Date();
  data.setUTCFullYear(data.getUTCFullYear() - IDADE_MAXIMA);
  return data.toISOString().slice(0, 10);
}

// ─── Campos ─────────────────────────────────────────────────────────────────

const nome = z
  .string({ error: 'O nome é obrigatório.' })
  .trim()
  .min(2, 'O nome deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome deve ter no máximo 120 caracteres.')
  .meta({ example: 'Ana Souza' });

const sexo = z.enum(SEXOS, { error: 'O sexo deve ser "masculino" ou "feminino".' });

const dataNascimento = z.iso
  .date({ error: 'A data de nascimento deve estar no formato AAAA-MM-DD.' })
  .refine((data) => data <= hoje(), 'A data de nascimento não pode ser no futuro.')
  .refine(
    (data) => data >= dataMinimaNascimento(),
    `A data de nascimento não pode ser de mais de ${IDADE_MAXIMA} anos atrás.`,
  )
  .meta({ example: '2008-05-17' });

/** Salvo sempre em minúsculas e sem espaços nas pontas. */
const email = z
  .string({ error: 'O e-mail deve ser um texto.' })
  .trim()
  .toLowerCase()
  .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
  .pipe(z.email({ error: 'E-mail inválido.' }))
  .meta({ example: 'ana.souza@email.com' });

/** Aceita com ou sem máscara; salvo só com dígitos (DDD + número). */
const telefone = z
  .string({ error: 'O telefone deve ser um texto.' })
  .transform((valor) => valor.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10,11}$/, 'O telefone deve ter DDD + número (10 ou 11 dígitos).'))
  .meta({ example: '(11) 98765-4321' });

// ─── Entrada ────────────────────────────────────────────────────────────────

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    return 'Envie os dados do aluno como objeto JSON no corpo da requisição.';
  }
  if (issue.code === 'unrecognized_keys') {
    return `Campo não permitido: ${issue.keys.join(', ')}.`;
  }
  return undefined;
}

export const alunoIdParamsSchema = z.object({
  id: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const criarAlunoBodySchema = z
  .strictObject(
    {
      nome,
      sexo,
      dataNascimento,
      email: email.optional(),
      telefone: telefone.optional(),
    },
    { error: erroCorpo },
  )
  .meta({ id: 'CriarAluno' });

/** Edição parcial: envie só o que muda. `null` em email/telefone remove o contato. */
export const atualizarAlunoBodySchema = z
  .strictObject(
    {
      nome: nome.optional(),
      sexo: sexo.optional(),
      dataNascimento: dataNascimento.optional(),
      email: email.nullable().optional(),
      telefone: telefone.nullable().optional(),
    },
    { error: erroCorpo },
  )
  .refine(
    (dados) => Object.values(dados).some((valor) => valor !== undefined),
    'Informe ao menos um campo para atualizar.',
  )
  .meta({ id: 'AtualizarAluno' });

export const listarAlunosQuerySchema = listQuerySchema({
  sortFields: ['nome', 'criadoEm'],
  defaultSort: 'nome',
  filters: {
    ativo: booleanQuery.optional().meta({ description: 'Filtra por situação (true/false).' }),
    sexo: sexo.optional().meta({ description: 'Filtra por sexo.' }),
  },
});

export type CriarAlunoBody = z.output<typeof criarAlunoBodySchema>;
export type AtualizarAlunoBody = z.output<typeof atualizarAlunoBodySchema>;
export type ListarAlunosQuery = z.output<typeof listarAlunosQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

export const alunoResponseSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    sexo: z.enum(SEXOS),
    dataNascimento: z.iso.date(),
    email: z.string().nullable(),
    telefone: z.string().nullable(),
    ativo: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'Aluno' });

export const listaAlunosResponseSchema = paginatedResponseSchema(alunoResponseSchema);

/** BE-ALU-03 · Perfil: dados básicos, sexo, nascimento (com idade calculada) e contato. */
export const perfilAlunoResponseSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    sexo: z.enum(SEXOS).meta({ description: 'Define qual modelo de anamnese o aluno recebe.' }),
    dataNascimento: z.iso.date(),
    idade: z.number().int().meta({ description: 'Anos completos, calculado na hora.' }),
    contato: z.object({
      email: z.string().nullable(),
      telefone: z.string().nullable().meta({ description: 'Só dígitos: DDD + número.' }),
    }),
    ativo: z.boolean(),
  })
  .meta({ id: 'PerfilAluno' });

export type AlunoResponse = z.output<typeof alunoResponseSchema>;
export type PerfilAlunoResponse = z.output<typeof perfilAlunoResponseSchema>;

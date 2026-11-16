import { z } from 'zod';

import {
  booleanQuery,
  listQuerySchema,
  paginatedResponseSchema,
} from '../../shared/http/pagination';

/**
 * Schemas Zod dos feedbacks: validam a entrada no controller e geram o contrato
 * OpenAPI (fonte única). Nomes iguais às tabelas:
 *   agendamento → a regra "o aluno X recebe o feedback Y com esta frequência" (DB-011)
 *   feedback    → cada liberação de um agendamento (tabela feedback_envios, DB-012)
 *   comentário  → texto do profissional sobre um feedback respondido (DB-013)
 *
 * Regras que dependem de mais de um campo ou do estado salvo (dia do mês na
 * recorrência mensal, lembrete menor que o intervalo, data no passado) ficam no
 * service, porque valem igual na criação e na edição.
 */

/** Mesmos valores dos tipos "recorrencia" e "status_feedback" do banco (DB-001). */
export const RECORRENCIAS = ['semanal', 'quinzenal', 'mensal', 'avulso'] as const;
export const STATUS_FEEDBACK = ['agendado', 'enviado', 'respondido', 'atrasado'] as const;

/** Teto geral do lembrete; o teto real depende da recorrência (ver feedbacks.agenda.ts). */
export const MAX_LEMBRETE_DIAS = 30;
export const MAX_TEXTO_COMENTARIO = 2000;

const EXEMPLO_DATA_HORA = '2026-11-09T08:00:00-03:00';

// ─── Campos ─────────────────────────────────────────────────────────────────

const alunoId = z.uuid({ error: 'O id do aluno deve ser um UUID válido.' });

const recorrencia = z
  .enum(RECORRENCIAS, {
    error: (issue) =>
      issue.input === undefined
        ? 'Informe a "recorrencia": semanal, quinzenal, mensal ou avulso.'
        : 'A "recorrencia" deve ser semanal, quinzenal, mensal ou avulso.',
  })
  .meta({ description: 'avulso = liberado uma vez só.' });

/** Data e hora ISO 8601 com fuso, para não haver dúvida de dia entre Brasil e UTC. */
function dataHora(campo: string) {
  return z.iso
    .datetime({
      offset: true,
      error: (issue) =>
        issue.input === undefined
          ? `Informe "${campo}" (data e hora ISO 8601 com fuso, ex.: ${EXEMPLO_DATA_HORA}).`
          : `"${campo}" deve ser data e hora ISO 8601 com fuso (ex.: ${EXEMPLO_DATA_HORA}).`,
    })
    .meta({ example: EXEMPLO_DATA_HORA });
}

/** BE-FBK-03 · Dias sem resposta até o lembrete. null = sem lembrete. */
const lembreteDias = z
  .number({ error: 'O "lembreteDias" deve ser um número inteiro de dias (ou null, sem lembrete).' })
  .int('O "lembreteDias" deve ser um número inteiro de dias.')
  .min(1, 'O lembrete deve ser de pelo menos 1 dia.')
  .max(MAX_LEMBRETE_DIAS, `O lembrete deve ser de no máximo ${MAX_LEMBRETE_DIAS} dias.`)
  .nullable()
  .meta({
    description:
      'BE-FBK-03 · Dias sem resposta até o aluno receber o lembrete. null = sem lembrete. ' +
      'Precisa ser menor que o intervalo da recorrência.',
  });

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    return 'Envie os dados como objeto JSON no corpo da requisição.';
  }
  if (issue.code === 'unrecognized_keys') {
    if (issue.keys.includes('modeloId')) {
      return 'O modelo não pode ser trocado. Desative este agendamento e crie outro.';
    }
    if (issue.keys.includes('ativo')) {
      return 'Para ativar ou desativar, use as rotas /ativar e /desativar.';
    }
    return `Campo não permitido: ${issue.keys.join(', ')}.`;
  }
  return undefined;
}

// ─── Entrada ────────────────────────────────────────────────────────────────

export const alunoParamsSchema = z.object({ alunoId });

export const agendamentoParamsSchema = z.object({
  alunoId,
  id: z.uuid({ error: 'O id do agendamento deve ser um UUID válido.' }),
});

export const feedbackParamsSchema = z.object({
  alunoId,
  id: z.uuid({ error: 'O id do feedback deve ser um UUID válido.' }),
});

/** BE-FBK-01 · Agendamento recorrente (ou avulso) de um modelo de feedback para o aluno. */
export const criarAgendamentoBodySchema = z
  .strictObject(
    {
      modeloId: z.uuid({
        error: (issue) =>
          issue.input === undefined
            ? 'Informe o "modeloId" do questionário de feedback.'
            : 'O "modeloId" deve ser um UUID válido.',
      }),
      recorrencia,
      primeiraLiberacao: dataHora('primeiraLiberacao').meta({
        description: 'Quando o primeiro feedback é liberado. Não pode estar no passado.',
      }),
      lembreteDias: lembreteDias.default(null),
    },
    { error: erroCorpo },
  )
  .meta({ id: 'CriarAgendamentoFeedback' });

/** BE-FBK-01/03 · Edição parcial: só os campos enviados mudam. Vale para os próximos envios. */
export const editarAgendamentoBodySchema = z
  .strictObject(
    {
      recorrencia: recorrencia.optional(),
      proximaLiberacao: dataHora('proximaLiberacao').optional(),
      lembreteDias: lembreteDias.optional(),
    },
    { error: erroCorpo },
  )
  .refine((body) => Object.values(body).some((valor) => valor !== undefined), {
    message:
      'Envie pelo menos um campo para alterar: recorrencia, proximaLiberacao ou lembreteDias.',
  })
  .meta({ id: 'EditarAgendamentoFeedback' });

/** Corpo opcional. A nova data é obrigatória quando a próxima liberação salva já passou. */
export const ativarAgendamentoBodySchema = z
  .strictObject({ proximaLiberacao: dataHora('proximaLiberacao').optional() }, { error: erroCorpo })
  .optional()
  .meta({ id: 'AtivarAgendamentoFeedback' });

export const listarAgendamentosQuerySchema = listQuerySchema({
  sortFields: ['proximaLiberacao', 'criadoEm'],
  defaultSort: 'proximaLiberacao',
  filters: {
    ativo: booleanQuery.optional().meta({ description: 'Filtra por situação (true/false).' }),
  },
}).omit({ q: true });

/** BE-FBK-04 · Feedbacks do aluno por status (painel e app). */
export const listarFeedbacksQuerySchema = listQuerySchema({
  sortFields: ['criadoEm', 'enviadoEm'],
  defaultSort: '-criadoEm',
  filters: {
    status: z
      .enum(STATUS_FEEDBACK, {
        error: 'O "status" deve ser agendado, enviado, respondido ou atrasado.',
      })
      .optional()
      .meta({ description: 'Filtra por status.' }),
    agendamentoId: z
      .uuid({ error: 'O "agendamentoId" deve ser um UUID válido.' })
      .optional()
      .meta({ description: 'Só os feedbacks de um agendamento.' }),
  },
}).omit({ q: true });

/** BE-FBK-05 · Comentário do profissional, visível ao aluno. */
export const criarComentarioBodySchema = z
  .strictObject(
    {
      texto: z
        .string({ error: 'Informe o "texto" do comentário.' })
        .trim()
        .min(1, 'O comentário não pode ficar vazio.')
        .max(
          MAX_TEXTO_COMENTARIO,
          `O comentário deve ter no máximo ${MAX_TEXTO_COMENTARIO} caracteres.`,
        ),
    },
    { error: erroCorpo },
  )
  .meta({ id: 'CriarComentarioFeedback' });

export type CriarAgendamentoBody = z.output<typeof criarAgendamentoBodySchema>;
export type EditarAgendamentoBody = z.output<typeof editarAgendamentoBodySchema>;
export type AtivarAgendamentoBody = z.output<typeof ativarAgendamentoBodySchema>;
export type ListarAgendamentosQuery = z.output<typeof listarAgendamentosQuerySchema>;
export type ListarFeedbacksQuery = z.output<typeof listarFeedbacksQuerySchema>;
export type CriarComentarioBody = z.output<typeof criarComentarioBodySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

const modeloResumo = z.object({ id: z.uuid(), nome: z.string() });

export const agendamentoResponseSchema = z
  .object({
    id: z.uuid(),
    alunoId: z.uuid(),
    modelo: modeloResumo,
    recorrencia: z.enum(RECORRENCIAS),
    proximaLiberacao: z.iso.datetime().meta({ description: 'Quando sai o próximo feedback.' }),
    lembreteDias: z.number().int().nullable(),
    ativo: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'AgendamentoFeedback' });

export const comentarioResponseSchema = z
  .object({ id: z.uuid(), texto: z.string(), criadoEm: z.iso.datetime() })
  .meta({ id: 'ComentarioFeedback' });

const camposFeedback = {
  id: z.uuid(),
  agendamentoId: z.uuid(),
  alunoId: z.uuid(),
  modelo: modeloResumo,
  status: z.enum(STATUS_FEEDBACK),
  submissaoId: z
    .uuid()
    .nullable()
    .meta({ description: 'Respostas do aluno (GET /alunos/{alunoId}/submissoes/{id}).' }),
  enviadoEm: z.iso.datetime().nullable(),
  lembretePrevistoEm: z.iso
    .datetime()
    .nullable()
    .meta({ description: 'BE-FBK-03 · Quando sai o lembrete, se o aluno não responder antes.' }),
  lembreteEm: z.iso.datetime().nullable().meta({ description: 'Quando o lembrete saiu.' }),
  respondidoEm: z.iso.datetime().nullable(),
  criadoEm: z.iso.datetime(),
  atualizadoEm: z.iso.datetime(),
};

export const feedbackResumoResponseSchema = z
  .object({ ...camposFeedback, totalComentarios: z.number().int() })
  .meta({ id: 'FeedbackResumo' });

export const feedbackResponseSchema = z
  .object({ ...camposFeedback, comentarios: z.array(comentarioResponseSchema) })
  .meta({ id: 'Feedback' });

export const listaAgendamentosResponseSchema = paginatedResponseSchema(agendamentoResponseSchema);
export const listaFeedbacksResponseSchema = paginatedResponseSchema(feedbackResumoResponseSchema);

export type AgendamentoResponse = z.output<typeof agendamentoResponseSchema>;
export type ComentarioResponse = z.output<typeof comentarioResponseSchema>;
export type FeedbackResumoResponse = z.output<typeof feedbackResumoResponseSchema>;
export type FeedbackResponse = z.output<typeof feedbackResponseSchema>;

import { z } from 'zod';

import { listQuerySchema, paginatedResponseSchema } from '../../shared/http/pagination';
import { perguntaResponseSchema, TIPOS_MODELO } from '../questionarios/questionarios.schemas';

/**
 * Schemas Zod das respostas: validam a entrada no controller e geram o contrato
 * OpenAPI (fonte única). Nomes iguais às tabelas submissoes (DB-009) e
 * respostas (DB-010):
 *   submissão → uma vez em que um questionário foi preenchido para o aluno
 *   resposta  → o valor de UMA pergunta dentro da submissão
 */

export const STATUS_SUBMISSAO = ['rascunho', 'final'] as const;
export const PREENCHIDO_POR = ['aluno', 'profissional'] as const;

const MAX_RESPOSTAS_POR_ENVIO = 100;

const EXEMPLO_DATA_HORA = '2026-11-04T09:30:00-03:00';

// ─── Campos ─────────────────────────────────────────────────────────────────

const alunoId = z.uuid({ error: 'O id do aluno deve ser um UUID válido.' });

const modeloId = z.uuid({
  error: (issue) =>
    issue.input === undefined
      ? 'Informe o "modeloId" do questionário a ser preenchido.'
      : 'O id do modelo deve ser um UUID válido.',
});

const tipoModelo = z.enum(TIPOS_MODELO, {
  error: 'O tipo deve ser "anamnese", "avaliacao" ou "feedback".',
});

/** Data e hora ISO 8601 com fuso, para não haver dúvida de dia entre Brasil e UTC. */
function dataHora(campo: string) {
  return z.iso
    .datetime({
      offset: true,
      error: `"${campo}" deve ser data e hora ISO 8601 com fuso (ex.: ${EXEMPLO_DATA_HORA}).`,
    })
    .meta({ example: EXEMPLO_DATA_HORA });
}

/**
 * Valor de uma resposta. O formato certo depende do tipo da pergunta e é
 * conferido no service (aqui só o formato JSON):
 *   texto_curto, texto_longo, escolha_unica → texto
 *   data                                    → texto "AAAA-MM-DD"
 *   numero, escala                          → número
 *   sim_nao                                 → true/false
 *   multipla_escolha                        → lista de textos
 * null = apagar a resposta daquela pergunta (só no rascunho).
 */
export const valorRespostaSchema = z
  .union([z.string(), z.number(), z.boolean(), z.array(z.string())], {
    error: (issue) =>
      issue.input === undefined
        ? 'Informe "valor" (use null para apagar a resposta).'
        : 'O "valor" deve ser texto, número, true/false ou lista de textos (null para apagar).',
  })
  .nullable()
  .meta({ description: 'Formato conforme o tipo da pergunta. null apaga a resposta.' });

const respostaInformada = z.strictObject(
  {
    perguntaId: z.uuid({
      error: (issue) =>
        issue.input === undefined
          ? 'Informe o "perguntaId" de cada resposta.'
          : 'O "perguntaId" deve ser um UUID válido.',
    }),
    valor: valorRespostaSchema,
  },
  {
    error: (issue) => {
      if (issue.code === 'unrecognized_keys') {
        return `Campo não permitido na resposta: ${issue.keys.join(', ')}.`;
      }
      return issue.code === 'invalid_type'
        ? 'Cada resposta deve ser um objeto { perguntaId, valor }.'
        : undefined;
    },
  },
);

const respostas = z
  .array(respostaInformada, { error: 'Envie as respostas como uma lista.' })
  .min(1, 'Envie pelo menos uma resposta.')
  .max(MAX_RESPOSTAS_POR_ENVIO, `Envie no máximo ${MAX_RESPOSTAS_POR_ENVIO} respostas por vez.`)
  .refine(
    (lista) => new Set(lista.map((item) => item.perguntaId)).size === lista.length,
    'A mesma pergunta aparece mais de uma vez na lista.',
  );

/** Mensagens claras para corpo ausente (ou que não é objeto) e campos não permitidos. */
function erroCorpo(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    return 'Envie os dados como objeto JSON no corpo da requisição.';
  }
  if (issue.code === 'unrecognized_keys') {
    return `Campo não permitido: ${issue.keys.join(', ')}.`;
  }
  return undefined;
}

// ─── Entrada ────────────────────────────────────────────────────────────────

export const alunoParamsSchema = z.object({ alunoId });

export const submissaoParamsSchema = z.object({
  alunoId,
  id: z.uuid({ error: 'O id da submissão deve ser um UUID válido.' }),
});

/** BE-RSP-02 · Abre um rascunho (ou retoma o que já está aberto). */
export const abrirSubmissaoBodySchema = z
  .strictObject({ modeloId }, { error: erroCorpo })
  .meta({ id: 'AbrirSubmissao' });

/** BE-RSP-02 · Autosave: grava só as perguntas enviadas; as demais ficam como estão. */
export const salvarRascunhoBodySchema = z
  .strictObject({ respostas }, { error: erroCorpo })
  .meta({ id: 'SalvarRascunho' });

/**
 * BE-RSP-01/03 · Envia a submissão (vira registro final e não muda mais).
 * Corpo opcional: `respostas` grava as últimas alterações antes de enviar;
 * `respondidoEm` só em avaliação (data em que o profissional fez a avaliação).
 */
export const finalizarSubmissaoBodySchema = z
  .strictObject(
    {
      respostas: respostas.optional(),
      respondidoEm: dataHora('respondidoEm')
        .optional()
        .meta({ description: 'Só em avaliação (BE-RSP-03). Padrão: agora.' }),
    },
    { error: erroCorpo },
  )
  .optional()
  .meta({ id: 'FinalizarSubmissao' });

/** BE-RSP-04 · Histórico do aluno: só submissões finais (rascunho não conta). */
export const listarSubmissoesQuerySchema = listQuerySchema({
  sortFields: ['respondidoEm'],
  defaultSort: '-respondidoEm',
  filters: {
    tipo: tipoModelo.optional().meta({ description: 'Filtra por tipo de questionário.' }),
    modeloId: z
      .uuid({ error: 'O "modeloId" deve ser um UUID válido.' })
      .optional()
      .meta({ description: 'Filtra por modelo.' }),
    de: dataHora('de').optional().meta({ description: 'Respondidas a partir desta data/hora.' }),
    ate: dataHora('ate').optional().meta({ description: 'Respondidas até esta data/hora.' }),
  },
})
  .omit({ q: true })
  .refine((query) => !query.de || !query.ate || Date.parse(query.de) <= Date.parse(query.ate), {
    message: 'A data "de" deve ser anterior ou igual à data "ate".',
    path: ['ate'],
  });

export type RespostaInformadaBody = z.output<typeof respostaInformada>;
export type AbrirSubmissaoBody = z.output<typeof abrirSubmissaoBodySchema>;
export type SalvarRascunhoBody = z.output<typeof salvarRascunhoBodySchema>;
export type FinalizarSubmissaoBody = z.output<typeof finalizarSubmissaoBodySchema>;
export type ListarSubmissoesQuery = z.output<typeof listarSubmissoesQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

const camposSubmissao = {
  id: z.uuid(),
  alunoId: z.uuid(),
  modelo: z.object({ id: z.uuid(), nome: z.string(), tipo: z.enum(TIPOS_MODELO) }),
  versao: z.number().int().meta({ description: 'Versão do modelo que foi respondida.' }),
  status: z.enum(STATUS_SUBMISSAO),
  preenchidoPor: z.enum(PREENCHIDO_POR),
  respondidoEm: z.iso
    .datetime()
    .nullable()
    .meta({ description: 'Data da resposta (ou da avaliação). null no rascunho.' }),
  criadoEm: z.iso.datetime(),
  atualizadoEm: z.iso.datetime().meta({ description: 'Último autosave, no rascunho.' }),
};

export const submissaoResumoResponseSchema = z
  .object({ ...camposSubmissao, totalRespostas: z.number().int() })
  .meta({ id: 'SubmissaoResumo' });

/** Pergunta da versão respondida + o valor dado (null = sem resposta). */
export const perguntaRespondidaResponseSchema = perguntaResponseSchema
  .extend({ valor: valorRespostaSchema })
  .meta({ id: 'PerguntaRespondida' });

export const submissaoResponseSchema = z
  .object({ ...camposSubmissao, perguntas: z.array(perguntaRespondidaResponseSchema) })
  .meta({ id: 'Submissao' });

export const listaSubmissoesResponseSchema = paginatedResponseSchema(submissaoResumoResponseSchema);

export type SubmissaoResumoResponse = z.output<typeof submissaoResumoResponseSchema>;
export type SubmissaoResponse = z.output<typeof submissaoResponseSchema>;

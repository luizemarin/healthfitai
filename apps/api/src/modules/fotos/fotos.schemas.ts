import { z } from 'zod';

import {
  booleanQuery,
  paginatedResponseSchema,
  paginationQuerySchema,
} from '../../shared/http/pagination';

/**
 * Schemas Zod do módulo de fotos: validam a entrada no controller e geram o
 * contrato OpenAPI (fonte única). Campos em português, iguais às colunas das
 * tabelas poses_foto (DB-014) e fotos (DB-015).
 */

/** Quem enviou a foto (tipo "papel" do DB-001). */
export const PAPEIS = ['profissional', 'aluno'] as const;

/** BE-FOT-02 · Tipos de arquivo aceitos no envio. */
export const TIPOS_ARQUIVO = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Teto absoluto do schema; o limite real vem do env (FOTO_TAMANHO_MAXIMO_MB). */
const TAMANHO_TETO_BYTES = 25 * 1024 * 1024;

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. Datas ISO comparam como texto. */
export function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

// ─── Campos ─────────────────────────────────────────────────────────────────

const nomePose = z
  .string({ error: 'O nome da pose é obrigatório.' })
  .trim()
  .min(1, 'O nome da pose é obrigatório.')
  .max(60, 'O nome da pose deve ter no máximo 60 caracteres.')
  .meta({ example: 'Lateral direita' });

const poseId = z.uuid({ error: 'O id da pose deve ser um UUID válido.' });

/** Dia da foto. Não pode ser no futuro (horário de Brasília). */
const dataRegistro = z.iso
  .date({ error: 'A data da foto deve estar no formato AAAA-MM-DD.' })
  .refine((data) => data <= hojeEmBrasilia(), 'A data da foto não pode ser no futuro.')
  .meta({ example: '2026-11-06' });

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

// ─── Entrada: poses (BE-FOT-01) ─────────────────────────────────────────────

export const poseIdParamsSchema = z.object({ id: poseId });

export const listarPosesQuerySchema = z.object({
  ativa: booleanQuery
    .optional()
    .meta({ description: 'Filtra por situação (true/false). Sem o filtro, vêm todas.' }),
});

export const criarPoseBodySchema = z
  .strictObject({ nome: nomePose }, { error: erroCorpo('os dados da pose') })
  .meta({ id: 'CriarPoseFoto' });

export const renomearPoseBodySchema = z
  .strictObject({ nome: nomePose }, { error: erroCorpo('os dados da pose') })
  .meta({ id: 'RenomearPoseFoto' });

export const reordenarPosesBodySchema = z
  .strictObject(
    {
      ids: z
        .array(poseId, { error: 'Envie "ids" como uma lista com os ids das poses.' })
        .min(1, 'Envie pelo menos uma pose.')
        .refine(
          (ids) => new Set(ids).size === ids.length,
          'Uma pose não pode aparecer mais de uma vez na lista.',
        )
        .meta({ description: 'Todas as poses ativas, na nova ordem.' }),
    },
    { error: erroCorpo('a nova ordem') },
  )
  .meta({ id: 'ReordenarPosesFoto' });

// ─── Entrada: envio de fotos (BE-FOT-02) ────────────────────────────────────

export const alunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const criarEnvioBodySchema = z
  .strictObject(
    {
      poseId,
      dataRegistro: dataRegistro
        .optional()
        .meta({ description: 'Dia da foto. Sem o campo, vale hoje (horário de Brasília).' }),
      tipoArquivo: z
        .enum(TIPOS_ARQUIVO, {
          error: `Tipo de arquivo não aceito. Envie a foto em ${TIPOS_ARQUIVO.join(', ')}.`,
        })
        .meta({ description: 'Content-Type do arquivo que será enviado.' }),
      tamanho: z
        .number({ error: 'Informe o "tamanho" do arquivo em bytes.' })
        .int('O "tamanho" deve ser um número inteiro de bytes.')
        .positive('O arquivo está vazio.')
        .max(TAMANHO_TETO_BYTES, 'A foto é grande demais.')
        .meta({ description: 'Tamanho exato do arquivo, em bytes.', example: 2_457_600 }),
    },
    { error: erroCorpo('os dados da foto') },
  )
  .meta({ id: 'CriarEnvioFoto' });

export const confirmarEnvioBodySchema = z
  .strictObject(
    {
      envioId: z.uuid({ error: 'O "envioId" deve ser o UUID recebido ao pedir o envio.' }),
      poseId,
      dataRegistro,
    },
    { error: erroCorpo('os dados de confirmação') },
  )
  .meta({
    id: 'ConfirmarEnvioFoto',
    description: 'Envie exatamente o objeto "confirmacao" recebido ao pedir o envio.',
  });

// ─── Entrada: galeria e comparador (BE-FOT-04) ──────────────────────────────

export const listarFotosQuerySchema = paginationQuerySchema
  .extend({
    sort: z
      .enum(['dataRegistro', '-dataRegistro'], {
        error: 'Ordenação inválida. Use "dataRegistro" ou "-dataRegistro".',
      })
      .default('-dataRegistro')
      .meta({ description: 'Ordem das datas. "-" = mais recentes primeiro (padrão).' }),
    poseId: poseId.optional().meta({ description: 'Só fotos desta pose.' }),
    de: dataFiltro('de').optional().meta({ description: 'Desde esta data (inclusive).' }),
    ate: dataFiltro('ate').optional().meta({ description: 'Até esta data (inclusive).' }),
  })
  .refine((query) => !query.de || !query.ate || query.de <= query.ate, {
    message: 'A data "de" deve ser anterior ou igual à data "ate".',
    path: ['ate'],
  });

export const compararFotosQuerySchema = z
  .object({
    antes: dataFiltro('antes').meta({ description: 'Data da foto "antes".' }),
    depois: dataFiltro('depois').meta({ description: 'Data da foto "depois".' }),
  })
  .refine((query) => query.antes < query.depois, {
    message: 'A data "depois" deve ser posterior à data "antes".',
    path: ['depois'],
  });

export type CriarEnvioBody = z.output<typeof criarEnvioBodySchema>;
export type ConfirmarEnvioBody = z.output<typeof confirmarEnvioBodySchema>;
export type ListarFotosQuery = z.output<typeof listarFotosQuerySchema>;
export type CompararFotosQuery = z.output<typeof compararFotosQuerySchema>;

// ─── Saída ──────────────────────────────────────────────────────────────────

export const poseResponseSchema = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    ordem: z.number().int().meta({ description: 'Ordem em que o app pede as fotos.' }),
    ativa: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .meta({ id: 'PoseFoto' });

export const listaPosesResponseSchema = z.object({ data: z.array(poseResponseSchema) });

export const envioResponseSchema = z
  .object({
    envioId: z.uuid(),
    url: z.url().meta({ description: 'URL assinada: envie o arquivo nela com PUT.' }),
    metodo: z.literal('PUT'),
    headers: z.record(z.string(), z.string()).meta({
      description: 'Headers obrigatórios no PUT (fazem parte da assinatura).',
      example: { 'Content-Type': 'image/jpeg' },
    }),
    expiraEm: z.iso.datetime().meta({ description: 'Depois disso, peça um novo envio.' }),
    /** Corpo para POST /alunos/{alunoId}/fotos depois que o PUT der certo. */
    confirmacao: confirmarEnvioBodySchema,
  })
  .meta({ id: 'EnvioFoto' });

export const fotoResponseSchema = z
  .object({
    id: z.uuid(),
    pose: z.object({
      id: z.uuid(),
      nome: z.string(),
      ordem: z.number().int(),
      ativa: z.boolean(),
    }),
    dataRegistro: z.iso.date(),
    tamanho: z.number().int().meta({ description: 'Bytes da foto processada.' }),
    criadoPor: z.enum(PAPEIS),
    criadoEm: z.iso.datetime(),
    url: z.url().meta({ description: 'URL assinada da foto (curta duração).' }),
    miniaturaUrl: z
      .url()
      .nullable()
      .meta({ description: 'URL assinada da miniatura (galeria). null se não houver.' }),
    urlsExpiramEm: z.iso
      .datetime()
      .meta({ description: 'Depois disso, busque a lista de novo para novas URLs.' }),
  })
  .meta({ id: 'Foto' });

export const grupoFotosResponseSchema = z
  .object({
    dataRegistro: z.iso.date(),
    fotos: z.array(fotoResponseSchema).meta({ description: 'Por ordem da pose.' }),
  })
  .meta({ id: 'FotosDoDia' });

export const galeriaResponseSchema = paginatedResponseSchema(grupoFotosResponseSchema);

export const comparacaoResponseSchema = z
  .object({
    antes: z.iso.date(),
    depois: z.iso.date(),
    poses: z
      .array(
        z.object({
          pose: fotoResponseSchema.shape.pose,
          antes: fotoResponseSchema.nullable(),
          depois: fotoResponseSchema.nullable(),
        }),
      )
      .meta({
        description:
          'Uma linha por pose (na ordem das poses). null = não há foto daquela pose na data.',
      }),
  })
  .meta({ id: 'ComparacaoFotos' });

export type PoseResponse = z.output<typeof poseResponseSchema>;
export type EnvioResponse = z.output<typeof envioResponseSchema>;
export type FotoResponse = z.output<typeof fotoResponseSchema>;
export type GrupoFotosResponse = z.output<typeof grupoFotosResponseSchema>;
export type ComparacaoResponse = z.output<typeof comparacaoResponseSchema>;

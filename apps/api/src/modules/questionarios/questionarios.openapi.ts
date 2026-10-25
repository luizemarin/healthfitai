import {
  criarModeloBodySchema,
  duplicarModeloBodySchema,
  editarModeloBodySchema,
  listaModelosResponseSchema,
  listarModelosQuerySchema,
  listaVersoesResponseSchema,
  modeloIdParamsSchema,
  modeloResponseSchema,
  versaoParamsSchema,
  versaoResponseSchema,
} from './questionarios.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Questionários'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const REGRAS_PERGUNTAS =
  'Tipos de pergunta (BE-QST-02): texto_curto, texto_longo, escolha_unica, multipla_escolha ' +
  '(com "opcoes"), sim_nao, numero (min/max/unidade opcionais), escala (min e max inteiros ' +
  'obrigatórios) e data. "exibirEvolucao" (BE-QST-03) só é aceito em numero e escala. ' +
  'A ordem das perguntas é a posição na lista.';

/** Contrato das rotas de modelos de questionário (BE-QST-01 a BE-QST-04). */
export function registerQuestionariosOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/modelos',
    tags: TAGS,
    summary: 'Criar modelo de questionário',
    description: `Cria o modelo já na versão 1. ${REGRAS_PERGUNTAS}`,
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(criarModeloBodySchema) },
    },
    responses: {
      201: { description: 'Modelo criado.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/modelos',
    tags: TAGS,
    summary: 'Listar modelos de questionário',
    description:
      'Modelos do profissional + modelos padrão do sistema (padrao = true). ' +
      'Busca por nome (q), filtros por tipo e situação, paginação e ordenação.',
    request: { headers: profissionalHeaderSchema, query: listarModelosQuerySchema },
    responses: {
      200: { description: 'Página de modelos.', content: json(listaModelosResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/modelos/{id}',
    tags: TAGS,
    summary: 'Detalhar modelo de questionário',
    description: 'Retorna o modelo com as perguntas da versão atual.',
    request: { headers: profissionalHeaderSchema, params: modeloIdParamsSchema },
    responses: {
      200: { description: 'Modelo.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/modelos/{id}',
    tags: TAGS,
    summary: 'Editar modelo de questionário',
    description:
      'Substitui nome, sexo-alvo e perguntas (o tipo não muda). Se as perguntas mudarem, ' +
      'cria a versão seguinte e as respostas antigas continuam na versão delas (BE-QST-04). ' +
      'Envie em "versao" a versão que foi aberta: se outra edição salvou antes, responde 409 ' +
      'MODELO_DESATUALIZADO. 403 MODELO_PADRAO_SOMENTE_LEITURA para modelo padrão; ' +
      `409 MODELO_INATIVO para modelo inativo. ${REGRAS_PERGUNTAS}`,
    request: {
      headers: profissionalHeaderSchema,
      params: modeloIdParamsSchema,
      body: { required: true, content: json(editarModeloBodySchema) },
    },
    responses: {
      200: { description: 'Modelo atualizado.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401, 403, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/modelos/{id}/duplicar',
    tags: TAGS,
    summary: 'Duplicar modelo de questionário',
    description:
      'Cria um modelo novo do profissional (versão 1, ativo) com as perguntas da versão atual. ' +
      'Funciona também com modelos padrão. Sem "nome", a cópia se chama "<nome> (cópia)".',
    request: {
      headers: profissionalHeaderSchema,
      params: modeloIdParamsSchema,
      body: { required: false, content: json(duplicarModeloBodySchema) },
    },
    responses: {
      201: { description: 'Cópia criada.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/modelos/{id}/desativar',
    tags: TAGS,
    summary: 'Desativar modelo de questionário',
    description:
      'Nada é apagado: as respostas antigas continuam ligadas ao modelo. ' +
      '409 MODELO_JA_INATIVO; 403 MODELO_PADRAO_SOMENTE_LEITURA.',
    request: { headers: profissionalHeaderSchema, params: modeloIdParamsSchema },
    responses: {
      200: { description: 'Modelo desativado.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401, 403, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/modelos/{id}/ativar',
    tags: TAGS,
    summary: 'Ativar modelo de questionário',
    description: '409 MODELO_JA_ATIVO; 403 MODELO_PADRAO_SOMENTE_LEITURA.',
    request: { headers: profissionalHeaderSchema, params: modeloIdParamsSchema },
    responses: {
      200: { description: 'Modelo ativado.', content: json(modeloResponseSchema) },
      ...errorResponses(400, 401, 403, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/modelos/{id}/versoes',
    tags: TAGS,
    summary: 'Histórico de versões do modelo',
    description: 'Versões do modelo, da mais recente para a mais antiga (BE-QST-04).',
    request: { headers: profissionalHeaderSchema, params: modeloIdParamsSchema },
    responses: {
      200: { description: 'Versões.', content: json(listaVersoesResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/modelos/{id}/versoes/{numero}',
    tags: TAGS,
    summary: 'Detalhar versão do modelo',
    description: 'Perguntas exatamente como estavam naquela versão (BE-QST-04).',
    request: { headers: profissionalHeaderSchema, params: versaoParamsSchema },
    responses: {
      200: { description: 'Versão.', content: json(versaoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });
}

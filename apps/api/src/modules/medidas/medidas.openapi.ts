import {
  alunoParamsSchema,
  criarTipoBodySchema,
  editarTipoBodySchema,
  historicoMedidasResponseSchema,
  historicoPesosResponseSchema,
  listaMedidasRegistradasResponseSchema,
  listarMedidasQuerySchema,
  listarPesosQuerySchema,
  listarTiposQuerySchema,
  listaTiposResponseSchema,
  registrarMedidasBodySchema,
  registrarPesoBodySchema,
  registroPesoResponseSchema,
  tipoIdParamsSchema,
  tipoMedidaResponseSchema,
} from './medidas.schemas';
import { MAX_TIPOS_ATIVOS } from './medidas.service';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS_TIPOS = ['Medidas · Tipos'];
const TAGS_REGISTROS = ['Peso e medidas'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const PRIMEIRO_ACESSO =
  'Na primeira vez, o profissional recebe uma cópia dos tipos padrão (Tórax, Cintura, Abdômen, Quadril, Braços, Coxas, Panturrilhas e Gordura corporal).';

const HISTORICO =
  'Nada é sobrescrito: registrar de novo = novo registro. Quem lançou vem em "registradoPor".';

/** Contrato das rotas de peso e medidas (BE-MED-01 e BE-MED-02). */
export function registerMedidasOpenApi(registry: OpenAPIRegistry): void {
  // ─── BE-MED-02 · Tipos de medida ──────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/tipos-medida',
    tags: TAGS_TIPOS,
    summary: 'Listar tipos de medida',
    description: `BE-MED-02 · Tipos do profissional, por ordem de criação. ${PRIMEIRO_ACESSO}`,
    request: { headers: profissionalHeaderSchema, query: listarTiposQuerySchema },
    responses: {
      200: { description: 'Tipos de medida.', content: json(listaTiposResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/tipos-medida',
    tags: TAGS_TIPOS,
    summary: 'Adicionar tipo de medida',
    description: `BE-MED-02 · 409 TIPO_MEDIDA_DUPLICADO (já existe um ativo com o mesmo nome, sem diferenciar maiúsculas/acentos); 409 LIMITE_TIPOS_MEDIDA (máximo de ${MAX_TIPOS_ATIVOS} ativos).`,
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(criarTipoBodySchema) },
    },
    responses: {
      201: { description: 'Tipo criado.', content: json(tipoMedidaResponseSchema) },
      ...errorResponses(400, 401, 409),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/tipos-medida/{id}',
    tags: TAGS_TIPOS,
    summary: 'Editar tipo de medida',
    description:
      'BE-MED-02 · Renomear é sempre permitido (o histórico passa a mostrar o nome novo). A unidade só muda enquanto o tipo não tem registros. 404 NOT_FOUND; 409 TIPO_MEDIDA_INATIVO; 409 TIPO_MEDIDA_DUPLICADO; 409 TIPO_MEDIDA_COM_REGISTROS.',
    request: {
      headers: profissionalHeaderSchema,
      params: tipoIdParamsSchema,
      body: { required: true, content: json(editarTipoBodySchema) },
    },
    responses: {
      200: { description: 'Tipo alterado.', content: json(tipoMedidaResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/tipos-medida/{id}/desativar',
    tags: TAGS_TIPOS,
    summary: 'Remover (desativar) tipo de medida',
    description:
      'BE-MED-02 · O tipo some da tela de lançamento, mas nada é apagado: o histórico continua no gráfico. 404 NOT_FOUND; 409 TIPO_MEDIDA_JA_INATIVO.',
    request: { headers: profissionalHeaderSchema, params: tipoIdParamsSchema },
    responses: {
      201: { description: 'Tipo desativado.', content: json(tipoMedidaResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/tipos-medida/{id}/ativar',
    tags: TAGS_TIPOS,
    summary: 'Reativar tipo de medida',
    description:
      'BE-MED-02 · 404 NOT_FOUND; 409 TIPO_MEDIDA_JA_ATIVO; 409 TIPO_MEDIDA_DUPLICADO; 409 LIMITE_TIPOS_MEDIDA.',
    request: { headers: profissionalHeaderSchema, params: tipoIdParamsSchema },
    responses: {
      201: { description: 'Tipo reativado.', content: json(tipoMedidaResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  // ─── BE-MED-01 · Peso ─────────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/pesos',
    tags: TAGS_REGISTROS,
    summary: 'Registrar peso',
    description: `BE-MED-01 · ${HISTORICO} 404 NOT_FOUND (aluno); 409 ALUNO_INATIVO.`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(registrarPesoBodySchema) },
    },
    responses: {
      201: { description: 'Peso registrado.', content: json(registroPesoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/pesos',
    tags: TAGS_REGISTROS,
    summary: 'Histórico de peso',
    description:
      'BE-MED-01 · Pesagens do aluno por data. Pode haver mais de uma no mesmo dia (a mais recente vale). Aluno inativo continua consultável. 404 NOT_FOUND (aluno).',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarPesosQuerySchema,
    },
    responses: {
      200: { description: 'Página de pesagens.', content: json(historicoPesosResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  // ─── BE-MED-01 · Medidas ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/medidas',
    tags: TAGS_REGISTROS,
    summary: 'Registrar medidas do dia',
    description: `BE-MED-01 · Várias medidas de uma vez (uma por tipo), todas na mesma data: ou entram todas, ou nenhuma. ${HISTORICO} Erros de um item trazem "details.field" apontando o item (ex.: body.medidas.2.tipoId). 404 NOT_FOUND (aluno ou tipo); 409 ALUNO_INATIVO; 409 TIPO_MEDIDA_INATIVO; 400 VALIDATION_ERROR (ex.: medida em % acima de 100).`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(registrarMedidasBodySchema) },
    },
    responses: {
      201: {
        description: 'Medidas registradas (na ordem enviada).',
        content: json(listaMedidasRegistradasResponseSchema),
      },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/medidas',
    tags: TAGS_REGISTROS,
    summary: 'Histórico de medidas',
    description:
      'BE-MED-01 · Medidas do aluno por data, com o tipo e a unidade. Filtrando por "tipoId", é uma curva do gráfico de evolução. Tipos desativados continuam aparecendo no histórico. 404 NOT_FOUND (aluno ou tipo do filtro).',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarMedidasQuerySchema,
    },
    responses: {
      200: { description: 'Página de medidas.', content: json(historicoMedidasResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });
}

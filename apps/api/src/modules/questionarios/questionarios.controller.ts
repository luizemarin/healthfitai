import {
  criarModeloBodySchema,
  duplicarModeloBodySchema,
  editarModeloBodySchema,
  listarModelosQuerySchema,
  modeloIdParamsSchema,
  versaoParamsSchema,
} from './questionarios.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type {
  ModeloQuestionario,
  Pergunta,
  ResumoVersao,
  VersaoModelo,
} from './questionarios.repository';
import type {
  ModeloResponse,
  ModeloResumoResponse,
  PerguntaResponse,
  VersaoResponse,
  VersaoResumoResponse,
} from './questionarios.schemas';
import type { QuestionariosService } from './questionarios.service';

function toPerguntaResponse(pergunta: Pergunta): PerguntaResponse {
  return {
    id: pergunta.id,
    ordem: pergunta.ordem,
    tipo: pergunta.tipo,
    enunciado: pergunta.enunciado,
    obrigatoria: pergunta.obrigatoria,
    exibirEvolucao: pergunta.exibirEvolucao,
    opcoes: pergunta.opcoes,
    unidade: pergunta.unidade,
    min: pergunta.min,
    max: pergunta.max,
  };
}

/** Formato público do modelo (não expõe o profissionalId; `padrao` indica modelo do sistema). */
function toResumoResponse(modelo: ModeloQuestionario): ModeloResumoResponse {
  return {
    id: modelo.id,
    tipo: modelo.tipo,
    nome: modelo.nome,
    sexoAlvo: modelo.sexoAlvo,
    padrao: modelo.profissionalId === null,
    ativo: modelo.ativo,
    versao: modelo.versao,
    totalPerguntas: modelo.perguntas.length,
    criadoEm: modelo.criadoEm.toISOString(),
    atualizadoEm: modelo.atualizadoEm.toISOString(),
  };
}

function toResponse(modelo: ModeloQuestionario): ModeloResponse {
  return { ...toResumoResponse(modelo), perguntas: modelo.perguntas.map(toPerguntaResponse) };
}

function toVersaoResumoResponse(versao: ResumoVersao): VersaoResumoResponse {
  return {
    numero: versao.numero,
    totalPerguntas: versao.totalPerguntas,
    criadoEm: versao.criadoEm.toISOString(),
  };
}

function toVersaoResponse(versao: VersaoModelo): VersaoResponse {
  return {
    modeloId: versao.modeloId,
    numero: versao.numero,
    criadoEm: versao.criadoEm.toISOString(),
    perguntas: versao.perguntas.map(toPerguntaResponse),
  };
}

/**
 * HTTP dos modelos de questionário: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class QuestionariosController {
  private readonly service: QuestionariosService;

  constructor(service: QuestionariosService) {
    this.service = service;
  }

  criar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: criarModeloBodySchema });

    const modelo = await this.service.criar(profissionalId, body);

    response.status(201).location(`/modelos/${modelo.id}`).json(toResponse(modelo));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarModelosQuerySchema });

    const { data, meta } = await this.service.listar(profissionalId, query);

    response.json({ data: data.map(toResumoResponse), meta });
  };

  buscarPorId: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: modeloIdParamsSchema });

    const modelo = await this.service.buscarPorId(profissionalId, params.id);

    response.json(toResponse(modelo));
  };

  editar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: modeloIdParamsSchema,
      body: editarModeloBodySchema,
    });

    const modelo = await this.service.editar(profissionalId, params.id, body);

    response.json(toResponse(modelo));
  };

  duplicar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: modeloIdParamsSchema,
      body: duplicarModeloBodySchema,
    });

    const modelo = await this.service.duplicar(profissionalId, params.id, body);

    response.status(201).location(`/modelos/${modelo.id}`).json(toResponse(modelo));
  };

  desativar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: modeloIdParamsSchema });

    const modelo = await this.service.desativar(profissionalId, params.id);

    response.json(toResponse(modelo));
  };

  ativar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: modeloIdParamsSchema });

    const modelo = await this.service.ativar(profissionalId, params.id);

    response.json(toResponse(modelo));
  };

  listarVersoes: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: modeloIdParamsSchema });

    const versoes = await this.service.listarVersoes(profissionalId, params.id);

    response.json({ data: versoes.map(toVersaoResumoResponse) });
  };

  buscarVersao: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: versaoParamsSchema });

    const versao = await this.service.buscarVersao(profissionalId, params.id, params.numero);

    response.json(toVersaoResponse(versao));
  };
}

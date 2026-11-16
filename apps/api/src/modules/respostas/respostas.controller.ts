import {
  abrirSubmissaoBodySchema,
  alunoParamsSchema,
  finalizarSubmissaoBodySchema,
  listarSubmissoesQuerySchema,
  salvarRascunhoBodySchema,
  submissaoParamsSchema,
} from './respostas.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { Submissao } from './respostas.repository';
import type { SubmissaoResponse, SubmissaoResumoResponse } from './respostas.schemas';
import type { RespostasService, SubmissaoComModelo, SubmissaoDetalhada } from './respostas.service';

function camposSubmissao(submissao: Submissao, modelo: SubmissaoDetalhada['modelo']) {
  return {
    id: submissao.id,
    alunoId: submissao.alunoId,
    modelo,
    versao: submissao.versao,
    status: submissao.status,
    preenchidoPor: submissao.preenchidoPor,
    respondidoEm: submissao.respondidoEm?.toISOString() ?? null,
    criadoEm: submissao.criadoEm.toISOString(),
    atualizadoEm: submissao.atualizadoEm.toISOString(),
  };
}

function toResumoResponse({ submissao, modelo }: SubmissaoComModelo): SubmissaoResumoResponse {
  return { ...camposSubmissao(submissao, modelo), totalRespostas: submissao.respostas.length };
}

/** Cada pergunta da versão respondida, já com o valor (null = sem resposta). */
function toResponse({ submissao, modelo, perguntas }: SubmissaoDetalhada): SubmissaoResponse {
  const valores = new Map(submissao.respostas.map((item) => [item.perguntaId, item.valor]));

  return {
    ...camposSubmissao(submissao, modelo),
    perguntas: perguntas.map((pergunta) => ({
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
      valor: valores.get(pergunta.id) ?? null,
    })),
  };
}

function localDa(submissao: Submissao): string {
  return `/alunos/${submissao.alunoId}/submissoes/${submissao.id}`;
}

/**
 * HTTP das respostas: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class RespostasController {
  private readonly service: RespostasService;

  constructor(service: RespostasService) {
    this.service = service;
  }

  abrir: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: abrirSubmissaoBodySchema,
    });

    const detalhe = await this.service.abrir(profissionalId, params.alunoId, body.modeloId);

    response.status(201).location(localDa(detalhe.submissao)).json(toResponse(detalhe));
  };

  salvarRascunho: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: submissaoParamsSchema,
      body: salvarRascunhoBodySchema,
    });

    const detalhe = await this.service.salvarRascunho(
      profissionalId,
      params.alunoId,
      params.id,
      body.respostas,
    );

    response.json(toResponse(detalhe));
  };

  finalizar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: submissaoParamsSchema,
      body: finalizarSubmissaoBodySchema,
    });

    const detalhe = await this.service.finalizar(profissionalId, params.alunoId, params.id, body);

    response.status(201).json(toResponse(detalhe));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarSubmissoesQuerySchema,
    });

    const { data, meta } = await this.service.listar(profissionalId, params.alunoId, query);

    response.json({ data: data.map(toResumoResponse), meta });
  };

  buscar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: submissaoParamsSchema });

    const detalhe = await this.service.buscar(profissionalId, params.alunoId, params.id);

    response.json(toResponse(detalhe));
  };
}

import {
  alunoParamsSchema,
  criarTipoBodySchema,
  editarTipoBodySchema,
  listarMedidasQuerySchema,
  listarPesosQuerySchema,
  listarTiposQuerySchema,
  registrarMedidasBodySchema,
  registrarPesoBodySchema,
  tipoIdParamsSchema,
} from './medidas.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { RegistroPeso, TipoMedida } from './medidas.repository';
import type {
  RegistroMedidaResponse,
  RegistroPesoResponse,
  TipoMedidaResponse,
} from './medidas.schemas';
import type { MedidaComTipo, MedidasService } from './medidas.service';

function toTipoResponse(tipo: TipoMedida): TipoMedidaResponse {
  return {
    id: tipo.id,
    nome: tipo.nome,
    unidade: tipo.unidade,
    ativo: tipo.ativo,
    criadoEm: tipo.criadoEm.toISOString(),
    atualizadoEm: tipo.atualizadoEm.toISOString(),
  };
}

function toPesoResponse(registro: RegistroPeso): RegistroPesoResponse {
  return {
    id: registro.id,
    pesoKg: registro.pesoKg,
    dataRegistro: registro.dataRegistro,
    registradoPor: registro.registradoPor,
    criadoEm: registro.criadoEm.toISOString(),
  };
}

function toMedidaResponse({ registro, tipo }: MedidaComTipo): RegistroMedidaResponse {
  return {
    id: registro.id,
    tipo: { id: tipo.id, nome: tipo.nome, unidade: tipo.unidade, ativo: tipo.ativo },
    valor: registro.valor,
    dataRegistro: registro.dataRegistro,
    registradoPor: registro.registradoPor,
    criadoEm: registro.criadoEm.toISOString(),
  };
}

/**
 * HTTP de peso e medidas: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class MedidasController {
  private readonly service: MedidasService;

  constructor(service: MedidasService) {
    this.service = service;
  }

  // ─── BE-MED-02 · Tipos de medida ──────────────────────────────────────────

  listarTipos: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarTiposQuerySchema });

    const tipos = await this.service.listarTipos(profissionalId, query.ativo);

    response.json({ data: tipos.map(toTipoResponse) });
  };

  criarTipo: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: criarTipoBodySchema });

    const tipo = await this.service.criarTipo(profissionalId, body.nome, body.unidade);

    response.status(201).location(`/tipos-medida/${tipo.id}`).json(toTipoResponse(tipo));
  };

  editarTipo: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: tipoIdParamsSchema,
      body: editarTipoBodySchema,
    });

    const tipo = await this.service.editarTipo(profissionalId, params.id, body);

    response.json(toTipoResponse(tipo));
  };

  desativarTipo: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: tipoIdParamsSchema });

    const tipo = await this.service.desativarTipo(profissionalId, params.id);

    response.status(201).json(toTipoResponse(tipo));
  };

  ativarTipo: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: tipoIdParamsSchema });

    const tipo = await this.service.ativarTipo(profissionalId, params.id);

    response.status(201).json(toTipoResponse(tipo));
  };

  // ─── BE-MED-01 · Peso ─────────────────────────────────────────────────────

  registrarPeso: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: registrarPesoBodySchema,
    });

    const registro = await this.service.registrarPeso(profissionalId, params.alunoId, body);

    response.status(201).json(toPesoResponse(registro));
  };

  listarPesos: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarPesosQuerySchema,
    });

    const { data, meta } = await this.service.listarPesos(profissionalId, params.alunoId, query);

    response.json({ data: data.map(toPesoResponse), meta });
  };

  // ─── BE-MED-01 · Medidas ──────────────────────────────────────────────────

  registrarMedidas: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: registrarMedidasBodySchema,
    });

    const medidas = await this.service.registrarMedidas(profissionalId, params.alunoId, body);

    response.status(201).json({ data: medidas.map(toMedidaResponse) });
  };

  listarMedidas: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarMedidasQuerySchema,
    });

    const { data, meta } = await this.service.listarMedidas(profissionalId, params.alunoId, query);

    response.json({ data: data.map(toMedidaResponse), meta });
  };
}

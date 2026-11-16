import {
  alunoParamsSchema,
  compararFotosQuerySchema,
  confirmarEnvioBodySchema,
  criarEnvioBodySchema,
  criarPoseBodySchema,
  listarFotosQuerySchema,
  listarPosesQuerySchema,
  poseIdParamsSchema,
  renomearPoseBodySchema,
  reordenarPosesBodySchema,
} from './fotos.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { PoseFoto } from './fotos.repository';
import type {
  ComparacaoResponse,
  EnvioResponse,
  FotoResponse,
  PoseResponse,
} from './fotos.schemas';
import type { Comparacao, EnvioCriado, FotosService, FotoVisivel } from './fotos.service';

function toPoseResponse(pose: PoseFoto): PoseResponse {
  return {
    id: pose.id,
    nome: pose.nome,
    ordem: pose.ordem,
    ativa: pose.ativa,
    criadoEm: pose.criadoEm.toISOString(),
    atualizadoEm: pose.atualizadoEm.toISOString(),
  };
}

function toEnvioResponse(envio: EnvioCriado): EnvioResponse {
  return {
    envioId: envio.envioId,
    url: envio.url,
    metodo: 'PUT',
    headers: { 'Content-Type': envio.contentType },
    expiraEm: envio.expiraEm.toISOString(),
    confirmacao: envio.confirmacao,
  };
}

/** Formato público da foto: nunca expõe as chaves do bucket, só URLs assinadas. */
function toFotoResponse({
  foto,
  pose,
  url,
  miniaturaUrl,
  urlsExpiramEm,
}: FotoVisivel): FotoResponse {
  return {
    id: foto.id,
    pose: { id: pose.id, nome: pose.nome, ordem: pose.ordem, ativa: pose.ativa },
    dataRegistro: foto.dataRegistro,
    tamanho: foto.tamanho,
    criadoPor: foto.criadoPor,
    criadoEm: foto.criadoEm.toISOString(),
    url,
    miniaturaUrl,
    urlsExpiramEm: urlsExpiramEm.toISOString(),
  };
}

function toComparacaoResponse(comparacao: Comparacao): ComparacaoResponse {
  return {
    antes: comparacao.antes,
    depois: comparacao.depois,
    poses: comparacao.poses.map((linha) => ({
      pose: {
        id: linha.pose.id,
        nome: linha.pose.nome,
        ordem: linha.pose.ordem,
        ativa: linha.pose.ativa,
      },
      antes: linha.antes ? toFotoResponse(linha.antes) : null,
      depois: linha.depois ? toFotoResponse(linha.depois) : null,
    })),
  };
}

/**
 * HTTP das fotos: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class FotosController {
  private readonly service: FotosService;

  constructor(service: FotosService) {
    this.service = service;
  }

  // ─── BE-FOT-01 · Poses ────────────────────────────────────────────────────

  listarPoses: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarPosesQuerySchema });

    const poses = await this.service.listarPoses(profissionalId, query.ativa);

    response.json({ data: poses.map(toPoseResponse) });
  };

  criarPose: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: criarPoseBodySchema });

    const pose = await this.service.criarPose(profissionalId, body.nome);

    response.status(201).location(`/poses/${pose.id}`).json(toPoseResponse(pose));
  };

  renomearPose: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: poseIdParamsSchema,
      body: renomearPoseBodySchema,
    });

    const pose = await this.service.renomearPose(profissionalId, params.id, body.nome);

    response.json(toPoseResponse(pose));
  };

  reordenarPoses: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: reordenarPosesBodySchema });

    const poses = await this.service.reordenarPoses(profissionalId, body.ids);

    response.json({ data: poses.map(toPoseResponse) });
  };

  desativarPose: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: poseIdParamsSchema });

    const pose = await this.service.desativarPose(profissionalId, params.id);

    response.status(201).json(toPoseResponse(pose));
  };

  ativarPose: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: poseIdParamsSchema });

    const pose = await this.service.ativarPose(profissionalId, params.id);

    response.status(201).json(toPoseResponse(pose));
  };

  // ─── BE-FOT-02 / BE-FOT-03 · Envio ────────────────────────────────────────

  criarEnvio: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: criarEnvioBodySchema,
    });

    const envio = await this.service.criarEnvio(profissionalId, params.alunoId, body);

    response.status(201).json(toEnvioResponse(envio));
  };

  confirmarEnvio: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: confirmarEnvioBodySchema,
    });

    const foto = await this.service.confirmarEnvio(profissionalId, params.alunoId, body);

    response.status(201).json(toFotoResponse(foto));
  };

  // ─── BE-FOT-04 · Galeria e comparador ─────────────────────────────────────

  listarGaleria: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarFotosQuerySchema,
    });

    const { data, meta } = await this.service.listarGaleria(profissionalId, params.alunoId, query);

    response.json({
      data: data.map((dia) => ({
        dataRegistro: dia.dataRegistro,
        fotos: dia.fotos.map(toFotoResponse),
      })),
      meta,
    });
  };

  comparar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: compararFotosQuerySchema,
    });

    const comparacao = await this.service.comparar(profissionalId, params.alunoId, query);

    response.json(toComparacaoResponse(comparacao));
  };
}

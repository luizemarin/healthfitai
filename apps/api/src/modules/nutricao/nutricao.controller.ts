import {
  alunoParamsSchema,
  criarPlanoBodySchema,
  editarPlanoBodySchema,
  listarPlanosQuerySchema,
  planoIdParamsSchema,
} from './nutricao.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { PlanoNutricional } from './nutricao.repository';
import type { PlanoResponse } from './nutricao.schemas';
import type { NutricaoService } from './nutricao.service';

function toPlanoResponse(plano: PlanoNutricional): PlanoResponse {
  return {
    id: plano.id,
    alunoId: plano.alunoId,
    nome: plano.nome,
    observacoes: plano.observacoes,
    ativo: plano.ativo,
    refeicoes: plano.refeicoes.map((item) => ({
      id: item.id,
      ordem: item.ordem,
      refeicao: item.refeicao,
      horario: item.horario,
      descricao: item.descricao,
    })),
    criadoEm: plano.criadoEm.toISOString(),
    atualizadoEm: plano.atualizadoEm.toISOString(),
  };
}

/**
 * HTTP dos planos nutricionais: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class NutricaoController {
  private readonly service: NutricaoService;

  constructor(service: NutricaoService) {
    this.service = service;
  }

  criar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: criarPlanoBodySchema,
    });

    const plano = await this.service.criar(profissionalId, params.alunoId, body);

    response.status(201).location(`/planos-nutricionais/${plano.id}`).json(toPlanoResponse(plano));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarPlanosQuerySchema,
    });

    const { data, meta } = await this.service.listar(profissionalId, params.alunoId, query);

    response.json({ data: data.map(toPlanoResponse), meta });
  };

  buscarAtivo: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: alunoParamsSchema });

    response.json(toPlanoResponse(await this.service.buscarAtivo(profissionalId, params.alunoId)));
  };

  buscarPorId: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: planoIdParamsSchema });

    response.json(toPlanoResponse(await this.service.buscarPorId(profissionalId, params.id)));
  };

  editar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: planoIdParamsSchema,
      body: editarPlanoBodySchema,
    });

    response.json(toPlanoResponse(await this.service.editar(profissionalId, params.id, body)));
  };

  encerrar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: planoIdParamsSchema });

    await this.service.encerrar(profissionalId, params.id);

    response.status(204).end();
  };
}

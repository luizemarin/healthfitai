import {
  criarExercicioBodySchema,
  editarExercicioBodySchema,
  exercicioIdParamsSchema,
  listarExerciciosQuerySchema,
} from './exercicios.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { Exercicio } from './exercicios.repository';
import type { ExercicioResponse } from './exercicios.schemas';
import type { ExerciciosService } from './exercicios.service';

function toResponse(exercicio: Exercicio): ExercicioResponse {
  return {
    id: exercicio.id,
    nome: exercicio.nome,
    grupoMuscular: exercicio.grupoMuscular,
    descricao: exercicio.descricao,
    midiaUrl: exercicio.midiaUrl,
    criadoEm: exercicio.criadoEm.toISOString(),
    atualizadoEm: exercicio.atualizadoEm.toISOString(),
  };
}

/**
 * HTTP da biblioteca de exercícios: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class ExerciciosController {
  private readonly service: ExerciciosService;

  constructor(service: ExerciciosService) {
    this.service = service;
  }

  criar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: criarExercicioBodySchema });

    const exercicio = await this.service.criar(profissionalId, body);

    response.status(201).location(`/exercicios/${exercicio.id}`).json(toResponse(exercicio));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarExerciciosQuerySchema });

    const { data, meta } = await this.service.listar(profissionalId, query);

    response.json({ data: data.map(toResponse), meta });
  };

  buscarPorId: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: exercicioIdParamsSchema });

    const exercicio = await this.service.buscarPorId(profissionalId, params.id);

    response.json(toResponse(exercicio));
  };

  editar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: exercicioIdParamsSchema,
      body: editarExercicioBodySchema,
    });

    const exercicio = await this.service.editar(profissionalId, params.id, body);

    response.json(toResponse(exercicio));
  };

  excluir: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: exercicioIdParamsSchema });

    await this.service.excluir(profissionalId, params.id);

    response.status(204).end();
  };
}

import {
  alunoParamsSchema,
  criarTreinoBodySchema,
  duplicarTreinoBodySchema,
  editarTreinoBodySchema,
  execucaoIdParamsSchema,
  finalizarExecucaoBodySchema,
  listarTreinosQuerySchema,
  treinoIdParamsSchema,
  treinoParamsSchema,
} from './treinos.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { ExecucaoResponse, ExercicioResumo, TreinoResponse } from './treinos.schemas';
import type { ExecucaoDetalhada, TreinoDetalhado, TreinosService } from './treinos.service';
import type { Exercicio } from '../exercicios/exercicios.repository';

/**
 * O exercício sempre existe (FK no banco). O "?" só protege a resposta: se faltar,
 * o item sai com o id e um nome genérico, em vez de derrubar a requisição.
 */
function toExercicioResumo(id: string, exercicio: Exercicio | undefined): ExercicioResumo {
  return exercicio
    ? {
        id: exercicio.id,
        nome: exercicio.nome,
        grupoMuscular: exercicio.grupoMuscular,
        ativo: exercicio.ativo,
      }
    : { id, nome: 'Exercício indisponível', grupoMuscular: '', ativo: false };
}

function toTreinoResponse({ treino, exercicios }: TreinoDetalhado): TreinoResponse {
  return {
    id: treino.id,
    alunoId: treino.alunoId,
    nome: treino.nome,
    exercicios: treino.itens.map((item) => ({
      id: item.id,
      ordem: item.ordem,
      exercicio: toExercicioResumo(item.exercicioId, exercicios.get(item.exercicioId)),
      series: item.series,
      repeticoes: item.repeticoes,
      descansoSegundos: item.descansoSegundos,
      cargaKg: item.cargaKg,
    })),
    criadoEm: treino.criadoEm.toISOString(),
    atualizadoEm: treino.atualizadoEm.toISOString(),
  };
}

function toExecucaoResponse({ execucao, exercicios }: ExecucaoDetalhada): ExecucaoResponse {
  const finalizadoEm = new Date(execucao.iniciadoEm.getTime() + execucao.duracaoSegundos * 1000);
  return {
    id: execucao.id,
    alunoId: execucao.alunoId,
    treinoId: execucao.treinoId,
    iniciadoEm: execucao.iniciadoEm.toISOString(),
    finalizadoEm: finalizadoEm.toISOString(),
    duracaoSegundos: execucao.duracaoSegundos,
    series: execucao.series.map((serie) => ({
      id: serie.id,
      exercicio: toExercicioResumo(serie.exercicioId, exercicios.get(serie.exercicioId)),
      serie: serie.serie,
      repeticoes: serie.repeticoes,
      cargaKg: serie.cargaKg,
      descansoSegundos: serie.descansoSegundos,
    })),
    criadoEm: execucao.criadoEm.toISOString(),
  };
}

/**
 * HTTP de treinos e execuções: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class TreinosController {
  private readonly service: TreinosService;

  constructor(service: TreinosService) {
    this.service = service;
  }

  // ─── BE-TRE-01 · Treinos ──────────────────────────────────────────────────

  criar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoParamsSchema,
      body: criarTreinoBodySchema,
    });

    const detalhado = await this.service.criar(profissionalId, params.alunoId, body);

    response
      .status(201)
      .location(`/treinos/${detalhado.treino.id}`)
      .json(toTreinoResponse(detalhado));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: listarTreinosQuerySchema,
    });

    const { data, meta } = await this.service.listar(profissionalId, params.alunoId, query);

    response.json({ data: data.map(toTreinoResponse), meta });
  };

  buscarPorId: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: treinoIdParamsSchema });

    response.json(toTreinoResponse(await this.service.buscarPorId(profissionalId, params.id)));
  };

  editar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: treinoIdParamsSchema,
      body: editarTreinoBodySchema,
    });

    response.json(toTreinoResponse(await this.service.editar(profissionalId, params.id, body)));
  };

  duplicar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: treinoIdParamsSchema,
      body: duplicarTreinoBodySchema,
    });

    const copia = await this.service.duplicar(profissionalId, params.id, body);

    response.status(201).location(`/treinos/${copia.treino.id}`).json(toTreinoResponse(copia));
  };

  remover: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: treinoIdParamsSchema });

    await this.service.remover(profissionalId, params.id);

    response.status(204).end();
  };

  // ─── BE-TRE-02 · Execução ─────────────────────────────────────────────────

  finalizarExecucao: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: treinoParamsSchema,
      body: finalizarExecucaoBodySchema,
    });

    const detalhada = await this.service.finalizarExecucao(profissionalId, params.treinoId, body);

    response
      .status(201)
      .location(`/execucoes-treino/${detalhada.execucao.id}`)
      .json(toExecucaoResponse(detalhada));
  };

  buscarExecucao: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: execucaoIdParamsSchema });

    response.json(toExecucaoResponse(await this.service.buscarExecucao(profissionalId, params.id)));
  };
}

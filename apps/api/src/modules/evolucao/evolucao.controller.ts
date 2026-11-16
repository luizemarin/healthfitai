import { alunoParamsSchema, evolucaoQuerySchema } from './evolucao.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { EvolucaoResponse } from './evolucao.schemas';
import type { Evolucao, EvolucaoService, SeriePergunta } from './evolucao.service';

function toPerguntaResponse({
  modelo,
  pergunta,
  pontos,
}: SeriePergunta): EvolucaoResponse['perguntas'][number] {
  return {
    perguntaId: pergunta.id,
    modelo,
    enunciado: pergunta.enunciado,
    // O repositório só entrega perguntas numero/escala (as únicas que podem ter o flag).
    tipo: pergunta.tipo as EvolucaoResponse['perguntas'][number]['tipo'],
    unidade: pergunta.unidade,
    min: pergunta.min,
    max: pergunta.max,
    pontos,
  };
}

function toEvolucaoResponse(evolucao: Evolucao): EvolucaoResponse {
  return {
    periodo: evolucao.periodo,
    peso: { unidade: 'kg', pontos: evolucao.pesos },
    medidas: evolucao.medidas,
    perguntas: evolucao.perguntas.map(toPerguntaResponse),
  };
}

/**
 * HTTP da evolução: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class EvolucaoController {
  private readonly service: EvolucaoService;

  constructor(service: EvolucaoService) {
    this.service = service;
  }

  // ─── BE-EVO-01 · Séries de evolução ───────────────────────────────────────

  buscar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: evolucaoQuerySchema,
    });

    const evolucao = await this.service.buscar(profissionalId, params.alunoId, query);

    response.json(toEvolucaoResponse(evolucao));
  };
}

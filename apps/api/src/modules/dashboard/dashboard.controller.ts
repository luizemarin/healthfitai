import {
  alunoParamsSchema,
  listarDashboardQuerySchema,
  periodoQuerySchema,
} from './dashboard.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type {
  DashboardAlunoItemResponse,
  DashboardAlunoResponse,
  ListaDashboardResponse,
} from './dashboard.schemas';
import type {
  DashboardAluno,
  DashboardService,
  Frequencia,
  ItemDashboard,
  PaginaDashboard,
  ProgressaoCarga,
} from './dashboard.service';
import type { Aluno } from '../alunos/alunos.repository';
import type { Exercicio } from '../exercicios/exercicios.repository';

function toAlunoResumo({ id, nome, ativo }: Aluno): DashboardAlunoItemResponse['aluno'] {
  return { id, nome, ativo };
}

function toFrequenciaResponse(frequencia: Frequencia): DashboardAlunoItemResponse['frequencia'] {
  return { ...frequencia, ultimoTreinoEm: frequencia.ultimoTreinoEm?.toISOString() ?? null };
}

function toItemResponse({ aluno, frequencia }: ItemDashboard): DashboardAlunoItemResponse {
  return { aluno: toAlunoResumo(aluno), frequencia: toFrequenciaResponse(frequencia) };
}

/**
 * O exercício sempre existe (FK no banco). O "?" só protege a resposta: se faltar,
 * sai com o id e um nome genérico, em vez de derrubar a requisição (igual a treinos).
 */
function toProgressaoResponse(
  { exercicioId, ...progressao }: ProgressaoCarga,
  exercicio: Exercicio | undefined,
): DashboardAlunoResponse['progressaoCarga'][number] {
  return {
    exercicio: exercicio
      ? {
          id: exercicio.id,
          nome: exercicio.nome,
          grupoMuscular: exercicio.grupoMuscular,
          ativo: exercicio.ativo,
        }
      : { id: exercicioId, nome: 'Exercício indisponível', grupoMuscular: '', ativo: false },
    ...progressao,
  };
}

function toListaResponse({ periodo, data, meta }: PaginaDashboard): ListaDashboardResponse {
  return { periodo, data: data.map(toItemResponse), meta };
}

function toDashboardAlunoResponse(dashboard: DashboardAluno): DashboardAlunoResponse {
  return {
    periodo: dashboard.periodo,
    aluno: toAlunoResumo(dashboard.aluno),
    frequencia: { ...toFrequenciaResponse(dashboard.frequencia), semanas: dashboard.semanas },
    progressaoCarga: dashboard.progressaoCarga.map((progressao) =>
      toProgressaoResponse(progressao, dashboard.exercicios.get(progressao.exercicioId)),
    ),
  };
}

/**
 * HTTP do painel: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class DashboardController {
  private readonly service: DashboardService;

  constructor(service: DashboardService) {
    this.service = service;
  }

  // ─── BE-DSH-01 · Frequência e progresso ───────────────────────────────────

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarDashboardQuerySchema });

    const pagina = await this.service.listar(profissionalId, query);

    response.json(toListaResponse(pagina));
  };

  buscarDoAluno: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, query } = validateRequest(request, {
      params: alunoParamsSchema,
      query: periodoQuerySchema,
    });

    const dashboard = await this.service.buscarDoAluno(profissionalId, params.alunoId, query);

    response.json(toDashboardAlunoResponse(dashboard));
  };
}

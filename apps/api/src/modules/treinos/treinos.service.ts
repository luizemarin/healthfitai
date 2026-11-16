import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type {
  ExecucaoTreino,
  NovoItemTreino,
  Treino,
  TreinosRepository,
} from './treinos.repository';
import type {
  CriarTreinoBody,
  DuplicarTreinoBody,
  EditarTreinoBody,
  FinalizarExecucaoBody,
  ItemTreinoBody,
  ListarTreinosQuery,
} from './treinos.schemas';
import type { ErrorDetail } from '../../shared/errors/app-error';
import type { Paginated } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';
import type { Exercicio, ExerciciosRepository } from '../exercicios/exercicios.repository';

/** BE-TRE-02 · Folga para relógio do celular adiantado ao comparar com "agora". */
const TOLERANCIA_RELOGIO_MS = 5 * 60 * 1000;

const SUFIXO_COPIA = ' (cópia)';
const NOME_MAXIMO = 120;

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: (acao: string) =>
    new AppError(409, 'ALUNO_INATIVO', `O aluno está inativo. Reative o aluno para ${acao}.`),
  treinoNaoEncontrado: () => AppError.notFound('Treino não encontrado.'),
  execucaoNaoEncontrada: () => AppError.notFound('Treino realizado não encontrado.'),
  exercicioNaoEncontrado: (details: ErrorDetail[]) =>
    new AppError(
      404,
      'EXERCICIO_NAO_ENCONTRADO',
      'Um ou mais exercícios não existem na sua biblioteca.',
      details,
    ),
  exercicioExcluido: (details: ErrorDetail[]) =>
    new AppError(
      409,
      'EXERCICIO_EXCLUIDO',
      'Um ou mais exercícios foram excluídos da biblioteca. Troque-os por outros exercícios.',
      details,
    ),
  duplicarComExcluido: (nomes: string[]) =>
    new AppError(
      409,
      'TREINO_COM_EXERCICIO_EXCLUIDO',
      `Não foi possível duplicar: o treino usa exercícios excluídos da biblioteca (${nomes.join(', ')}). ` +
        'Edite o treino e troque esses exercícios antes de duplicar.',
    ),
  horarioNoFuturo: (field: string, message: string) =>
    AppError.validation([{ field, message }], 'O horário do treino não pode ser no futuro.'),
  execucaoJaRegistrada: () =>
    new AppError(
      409,
      'EXECUCAO_JA_REGISTRADA',
      'Este treino já foi registrado com o mesmo horário de início. Nada foi duplicado.',
    ),
};

/** Treino com os exercícios da biblioteca que ele usa (nome e grupo para a resposta). */
export interface TreinoDetalhado {
  treino: Treino;
  exercicios: Map<string, Exercicio>;
}

/** Execução com os exercícios da biblioteca que ela usa. */
export interface ExecucaoDetalhada {
  execucao: ExecucaoTreino;
  exercicios: Map<string, Exercicio>;
}

/** A ordem do treino é a posição na lista (1, 2, 3...). */
function paraItens(exercicios: ItemTreinoBody[]): NovoItemTreino[] {
  return exercicios.map((item, indice) => ({
    exercicioId: item.exercicioId,
    ordem: indice + 1,
    series: item.series,
    repeticoes: item.repeticoes,
    descansoSegundos: item.descansoSegundos,
    cargaKg: item.cargaKg ?? null,
  }));
}

function nomeDaCopia(nome: string): string {
  return `${nome.slice(0, NOME_MAXIMO - SUFIXO_COPIA.length)}${SUFIXO_COPIA}`;
}

/**
 * Treinos do aluno.
 *   BE-TRE-01 · montar, editar, duplicar e remover treinos (séries, repetições, descanso e carga)
 *   BE-TRE-02 · registrar o treino feito (carga e repetições por série, descanso, duração)
 *
 * O dono do treino é o profissional do aluno: treino de aluno de outro
 * profissional = "não encontrado". Não conhece HTTP/Express.
 */
export class TreinosService {
  private readonly repository: TreinosRepository;

  private readonly alunos: AlunosRepository;

  private readonly exercicios: ExerciciosRepository;

  constructor(
    repository: TreinosRepository,
    alunos: AlunosRepository,
    exercicios: ExerciciosRepository,
  ) {
    this.repository = repository;
    this.alunos = alunos;
    this.exercicios = exercicios;
  }

  // ─── BE-TRE-01 · Treinos ──────────────────────────────────────────────────

  async criar(
    profissionalId: string,
    alunoId: string,
    body: CriarTreinoBody,
  ): Promise<TreinoDetalhado> {
    await this.alunoAtivo(profissionalId, alunoId, 'montar treinos');
    const exercicios = await this.exerciciosParaPrescrever(profissionalId, body.exercicios);

    const treino = await this.repository.criarTreino({
      alunoId,
      nome: body.nome,
      itens: paraItens(body.exercicios),
    });
    return { treino, exercicios };
  }

  async listar(
    profissionalId: string,
    alunoId: string,
    query: ListarTreinosQuery,
  ): Promise<Paginated<TreinoDetalhado>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.listarTreinos(alunoId, {
      q: query.q,
      sort: query.sort,
      ...toSkipTake(query),
    });
    const exercicios = await this.exerciciosPorId(
      profissionalId,
      items.flatMap((treino) => treino.itens.map((item) => item.exercicioId)),
    );

    return paginate(
      items.map((treino) => ({ treino, exercicios })),
      total,
      query,
    );
  }

  async buscarPorId(profissionalId: string, id: string): Promise<TreinoDetalhado> {
    const treino = await this.treinoAtivo(profissionalId, id);
    return this.detalhar(profissionalId, treino);
  }

  /** "exercicios" substitui a lista inteira: o editor sempre manda o treino completo. */
  async editar(
    profissionalId: string,
    id: string,
    body: EditarTreinoBody,
  ): Promise<TreinoDetalhado> {
    const treino = await this.treinoAtivo(profissionalId, id);
    await this.alunoAtivo(profissionalId, treino.alunoId, 'alterar treinos');
    if (body.exercicios !== undefined) {
      await this.exerciciosParaPrescrever(profissionalId, body.exercicios);
    }

    const atualizado = await this.repository.atualizarTreino(id, {
      nome: body.nome,
      itens: body.exercicios === undefined ? undefined : paraItens(body.exercicios),
    });
    if (!atualizado) {
      // Removido entre a busca e a alteração.
      throw Erros.treinoNaoEncontrado();
    }
    return this.detalhar(profissionalId, atualizado);
  }

  /**
   * Novo treino com cópia dos itens (séries, repetições, descanso e carga).
   * Pode ir para o mesmo aluno ou para outro aluno do profissional.
   */
  async duplicar(
    profissionalId: string,
    id: string,
    body: DuplicarTreinoBody,
  ): Promise<TreinoDetalhado> {
    const original = await this.treinoAtivo(profissionalId, id);
    const alunoId = body?.alunoId ?? original.alunoId;
    await this.alunoAtivo(profissionalId, alunoId, 'receber treinos');

    const exercicios = await this.exerciciosPorId(
      profissionalId,
      original.itens.map((item) => item.exercicioId),
    );
    const excluidos = [...exercicios.values()].filter((exercicio) => !exercicio.ativo);
    if (excluidos.length > 0) {
      throw Erros.duplicarComExcluido(excluidos.map((exercicio) => exercicio.nome));
    }

    const copia = await this.repository.criarTreino({
      alunoId,
      nome: body?.nome ?? nomeDaCopia(original.nome),
      itens: original.itens.map((item) => ({
        exercicioId: item.exercicioId,
        ordem: item.ordem,
        series: item.series,
        repeticoes: item.repeticoes,
        descansoSegundos: item.descansoSegundos,
        cargaKg: item.cargaKg,
      })),
    });
    return { treino: copia, exercicios };
  }

  /** Remover = desativar: o histórico de execuções continua apontando para ele. */
  async remover(profissionalId: string, id: string): Promise<void> {
    await this.treinoAtivo(profissionalId, id);
    const removeu = await this.repository.desativarTreino(id);
    if (!removeu) {
      throw Erros.treinoNaoEncontrado();
    }
  }

  // ─── BE-TRE-02 · Execução ─────────────────────────────────────────────────

  /**
   * Registra o treino feito. O app envia tudo de uma vez ao tocar em
   * "Finalizar treino" (funciona offline: guarda e envia depois). Nada é
   * sobrescrito: treinou de novo = nova execução.
   *
   * Pensado para o envio offline, duas regras são tolerantes:
   *   - vale para treino removido depois que o aluno começou;
   *   - a série pode ser de exercício que saiu do treino ou da biblioteca nesse meio tempo.
   * Reenvio do mesmo treino (mesmo início) é barrado: não duplica o histórico.
   */
  async finalizarExecucao(
    profissionalId: string,
    treinoId: string,
    body: FinalizarExecucaoBody,
  ): Promise<ExecucaoDetalhada> {
    const treino = await this.treinoDoProfissional(profissionalId, treinoId);
    await this.alunoAtivo(profissionalId, treino.alunoId, 'registrar treinos');

    const iniciadoEm = new Date(body.iniciadoEm);
    const limite = Date.now() + TOLERANCIA_RELOGIO_MS;
    if (iniciadoEm.getTime() > limite) {
      throw Erros.horarioNoFuturo(
        'body.iniciadoEm',
        'O início do treino não pode ser no futuro. Confira a data e a hora do celular.',
      );
    }
    if (iniciadoEm.getTime() + body.duracaoSegundos * 1000 > limite) {
      throw Erros.horarioNoFuturo(
        'body.duracaoSegundos',
        'Início + duração termina no futuro. Confira "iniciadoEm" e "duracaoSegundos".',
      );
    }

    const exercicios = await this.exerciciosPorId(
      profissionalId,
      body.series.map((serie) => serie.exercicioId),
    );
    const inexistentes = body.series.flatMap((serie, indice) =>
      exercicios.has(serie.exercicioId)
        ? []
        : [
            {
              field: `body.series.${String(indice)}.exercicioId`,
              message: `O exercício ${serie.exercicioId} não existe na biblioteca do profissional.`,
            },
          ],
    );
    if (inexistentes.length > 0) {
      throw Erros.exercicioNaoEncontrado(inexistentes);
    }

    if (await this.repository.buscarExecucaoPorInicio(treinoId, iniciadoEm)) {
      throw Erros.execucaoJaRegistrada();
    }

    const execucao = await this.repository.criarExecucao({
      alunoId: treino.alunoId,
      treinoId,
      iniciadoEm,
      duracaoSegundos: body.duracaoSegundos,
      series: body.series.map((serie) => ({
        exercicioId: serie.exercicioId,
        serie: serie.serie,
        repeticoes: serie.repeticoes,
        cargaKg: serie.cargaKg ?? null,
        descansoSegundos: serie.descansoSegundos ?? null,
      })),
    });
    return { execucao, exercicios };
  }

  async buscarExecucao(profissionalId: string, id: string): Promise<ExecucaoDetalhada> {
    const execucao = await this.repository.buscarExecucao(id);
    if (!execucao || !(await this.alunos.findById(profissionalId, execucao.alunoId))) {
      throw Erros.execucaoNaoEncontrada();
    }
    const exercicios = await this.exerciciosPorId(
      profissionalId,
      execucao.series.map((serie) => serie.exercicioId),
    );
    return { execucao, exercicios };
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async alunoAtivo(profissionalId: string, alunoId: string, acao: string): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo(acao);
    }
    return aluno;
  }

  /** Treino (mesmo removido) de um aluno do profissional. Senão, "não encontrado". */
  private async treinoDoProfissional(profissionalId: string, id: string): Promise<Treino> {
    const treino = await this.repository.buscarTreino(id);
    if (!treino || !(await this.alunos.findById(profissionalId, treino.alunoId))) {
      throw Erros.treinoNaoEncontrado();
    }
    return treino;
  }

  /** Para montar/editar/duplicar: treino removido = "não encontrado". */
  private async treinoAtivo(profissionalId: string, id: string): Promise<Treino> {
    const treino = await this.treinoDoProfissional(profissionalId, id);
    if (!treino.ativo) {
      throw Erros.treinoNaoEncontrado();
    }
    return treino;
  }

  /** Exercícios da biblioteca do profissional (inclui os excluídos), por id. */
  private async exerciciosPorId(
    profissionalId: string,
    ids: string[],
  ): Promise<Map<string, Exercicio>> {
    const encontrados = await this.exercicios.findByIds(profissionalId, [...new Set(ids)]);
    return new Map(encontrados.map((exercicio) => [exercicio.id, exercicio]));
  }

  /** Para prescrever, o exercício tem de existir na biblioteca e não pode estar excluído. */
  private async exerciciosParaPrescrever(
    profissionalId: string,
    itens: ItemTreinoBody[],
  ): Promise<Map<string, Exercicio>> {
    const exercicios = await this.exerciciosPorId(
      profissionalId,
      itens.map((item) => item.exercicioId),
    );

    const campo = (indice: number) => `body.exercicios.${String(indice)}.exercicioId`;
    const inexistentes: ErrorDetail[] = [];
    const excluidos: ErrorDetail[] = [];
    itens.forEach((item, indice) => {
      const exercicio = exercicios.get(item.exercicioId);
      if (!exercicio) {
        inexistentes.push({
          field: campo(indice),
          message: `O exercício ${item.exercicioId} não existe na sua biblioteca.`,
        });
      } else if (!exercicio.ativo) {
        excluidos.push({
          field: campo(indice),
          message: `O exercício "${exercicio.nome}" foi excluído da biblioteca.`,
        });
      }
    });

    if (inexistentes.length > 0) {
      throw Erros.exercicioNaoEncontrado(inexistentes);
    }
    if (excluidos.length > 0) {
      throw Erros.exercicioExcluido(excluidos);
    }
    return exercicios;
  }

  private async detalhar(profissionalId: string, treino: Treino): Promise<TreinoDetalhado> {
    const exercicios = await this.exerciciosPorId(
      profissionalId,
      treino.itens.map((item) => item.exercicioId),
    );
    return { treino, exercicios };
  }
}

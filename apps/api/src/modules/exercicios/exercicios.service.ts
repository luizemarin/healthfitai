import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type { Exercicio, ExerciciosRepository } from './exercicios.repository';
import type {
  CriarExercicioBody,
  EditarExercicioBody,
  ListarExerciciosQuery,
} from './exercicios.schemas';
import type { Paginated } from '../../shared/http/pagination';

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  naoEncontrado: () => AppError.notFound('Exercício não encontrado.'),
  duplicado: (nome: string) =>
    new AppError(
      409,
      'EXERCICIO_DUPLICADO',
      `Já existe um exercício chamado "${nome}" na sua biblioteca.`,
    ),
};

/**
 * BE-EXE-01 · Biblioteca de exercícios do profissional (criar, listar, editar e excluir).
 * Excluir é lógico: o exercício some da biblioteca, mas o que já usa ele
 * (treinos, execuções) continua íntegro. Não conhece HTTP/Express.
 */
export class ExerciciosService {
  private readonly repository: ExerciciosRepository;

  constructor(repository: ExerciciosRepository) {
    this.repository = repository;
  }

  async criar(profissionalId: string, dados: CriarExercicioBody): Promise<Exercicio> {
    await this.garantirNomeLivre(profissionalId, dados.nome);

    return this.repository.create({
      profissionalId,
      nome: dados.nome,
      grupoMuscular: dados.grupoMuscular,
      descricao: dados.descricao ?? null,
      midiaUrl: dados.midiaUrl ?? null,
    });
  }

  async listar(
    profissionalId: string,
    query: ListarExerciciosQuery,
  ): Promise<Paginated<Exercicio>> {
    const { items, total } = await this.repository.list(profissionalId, {
      q: query.q,
      grupoMuscular: query.grupoMuscular,
      sort: query.sort,
      ...toSkipTake(query),
    });
    return paginate(items, total, query);
  }

  async buscarPorId(profissionalId: string, id: string): Promise<Exercicio> {
    const exercicio = await this.repository.findById(profissionalId, id);
    if (!exercicio) {
      throw Erros.naoEncontrado();
    }
    return exercicio;
  }

  async editar(profissionalId: string, id: string, dados: EditarExercicioBody): Promise<Exercicio> {
    // Confere a existência antes: "não encontrado" tem prioridade sobre "nome duplicado".
    await this.buscarPorId(profissionalId, id);

    if (dados.nome !== undefined) {
      await this.garantirNomeLivre(profissionalId, dados.nome, id);
    }

    const exercicio = await this.repository.update(profissionalId, id, dados);
    if (!exercicio) {
      // Excluído entre a busca e a alteração.
      throw Erros.naoEncontrado();
    }
    return exercicio;
  }

  async excluir(profissionalId: string, id: string): Promise<void> {
    const excluiu = await this.repository.desativar(profissionalId, id);
    if (!excluiu) {
      throw Erros.naoEncontrado();
    }
  }

  /**
   * Dois exercícios ativos não podem ter o mesmo nome (sem diferenciar
   * maiúsculas/acentos): na hora de montar o treino o profissional não saberia
   * qual escolher. Na edição, o próprio exercício não conta (`ignorarId`).
   */
  private async garantirNomeLivre(
    profissionalId: string,
    nome: string,
    ignorarId?: string,
  ): Promise<void> {
    const existente = await this.repository.findAtivoPorNome(profissionalId, nome);
    if (existente && existente.id !== ignorarId) {
      throw Erros.duplicado(existente.nome);
    }
  }
}

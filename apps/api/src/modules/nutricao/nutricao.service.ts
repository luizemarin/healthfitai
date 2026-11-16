import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type {
  NovaRefeicaoPlano,
  NutricaoRepository,
  PlanoNutricional,
} from './nutricao.repository';
import type {
  CriarPlanoBody,
  EditarPlanoBody,
  ListarPlanosQuery,
  RefeicaoBody,
} from './nutricao.schemas';
import type { Paginated } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: (acao: string) =>
    new AppError(409, 'ALUNO_INATIVO', `O aluno está inativo. Reative o aluno para ${acao}.`),
  planoNaoEncontrado: () => AppError.notFound('Plano nutricional não encontrado.'),
  semPlanoAtivo: () =>
    new AppError(
      404,
      'PLANO_NUTRICIONAL_NAO_DEFINIDO',
      'O aluno ainda não tem um plano nutricional em uso.',
    ),
  planoInativo: () =>
    new AppError(
      409,
      'PLANO_NUTRICIONAL_INATIVO',
      'Este plano nutricional não está mais em uso e não pode ser alterado. Crie um novo plano para o aluno.',
    ),
};

/** A ordem do plano é a posição na lista (1, 2, 3...). */
function paraRefeicoes(refeicoes: RefeicaoBody[]): NovaRefeicaoPlano[] {
  return refeicoes.map((item, indice) => ({
    ordem: indice + 1,
    refeicao: item.refeicao,
    horario: item.horario ?? null,
    descricao: item.descricao,
  }));
}

/**
 * BE-NUT-01 · Plano alimentar do aluno.
 *
 * Regras:
 *   - O aluno tem no máximo UM plano em uso (ativo). Criar um plano novo
 *     substitui o atual, que vai para o histórico (nada é apagado).
 *   - Só o plano em uso pode ser editado ou encerrado.
 *   - O dono do plano é o profissional do aluno: plano de aluno de outro
 *     profissional = "não encontrado".
 *
 * Não conhece HTTP/Express.
 */
export class NutricaoService {
  private readonly repository: NutricaoRepository;

  private readonly alunos: AlunosRepository;

  constructor(repository: NutricaoRepository, alunos: AlunosRepository) {
    this.repository = repository;
    this.alunos = alunos;
  }

  async criar(
    profissionalId: string,
    alunoId: string,
    body: CriarPlanoBody,
  ): Promise<PlanoNutricional> {
    await this.alunoAtivo(profissionalId, alunoId, 'criar um plano nutricional');

    return this.repository.criarPlano({
      alunoId,
      nome: body.nome,
      observacoes: body.observacoes ?? null,
      refeicoes: paraRefeicoes(body.refeicoes),
    });
  }

  /** Histórico de planos do aluno (o em uso e os antigos). */
  async listar(
    profissionalId: string,
    alunoId: string,
    query: ListarPlanosQuery,
  ): Promise<Paginated<PlanoNutricional>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.listarPlanos(alunoId, {
      q: query.q,
      ativo: query.ativo,
      sort: query.sort,
      ...toSkipTake(query),
    });
    return paginate(items, total, query);
  }

  /** O plano que o aluno está seguindo agora (o app mostra este). */
  async buscarAtivo(profissionalId: string, alunoId: string): Promise<PlanoNutricional> {
    await this.buscarAluno(profissionalId, alunoId);

    const plano = await this.repository.buscarPlanoAtivo(alunoId);
    if (!plano) {
      throw Erros.semPlanoAtivo();
    }
    return plano;
  }

  /** Qualquer plano do histórico (em uso ou antigo). */
  async buscarPorId(profissionalId: string, id: string): Promise<PlanoNutricional> {
    return this.planoDoProfissional(profissionalId, id);
  }

  /** "refeicoes" substitui a lista inteira: o editor sempre manda o plano completo. */
  async editar(
    profissionalId: string,
    id: string,
    body: EditarPlanoBody,
  ): Promise<PlanoNutricional> {
    const plano = await this.planoEmUso(profissionalId, id);
    await this.alunoAtivo(profissionalId, plano.alunoId, 'alterar o plano nutricional');

    const atualizado = await this.repository.atualizarPlano(id, {
      nome: body.nome,
      observacoes: body.observacoes,
      refeicoes: body.refeicoes === undefined ? undefined : paraRefeicoes(body.refeicoes),
    });
    if (!atualizado) {
      // Substituído ou encerrado entre a busca e a alteração.
      throw Erros.planoInativo();
    }
    return atualizado;
  }

  /** Encerrar = desativar: o aluno fica sem plano em uso e este vai para o histórico. */
  async encerrar(profissionalId: string, id: string): Promise<void> {
    await this.planoEmUso(profissionalId, id);
    const encerrou = await this.repository.desativarPlano(id);
    if (!encerrou) {
      throw Erros.planoInativo();
    }
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

  /** Plano (em uso ou antigo) de um aluno do profissional. Senão, "não encontrado". */
  private async planoDoProfissional(profissionalId: string, id: string): Promise<PlanoNutricional> {
    const plano = await this.repository.buscarPlano(id);
    if (!plano || !(await this.alunos.findById(profissionalId, plano.alunoId))) {
      throw Erros.planoNaoEncontrado();
    }
    return plano;
  }

  /** Para editar/encerrar: plano antigo = 409 (ele existe, mas não pode mudar). */
  private async planoEmUso(profissionalId: string, id: string): Promise<PlanoNutricional> {
    const plano = await this.planoDoProfissional(profissionalId, id);
    if (!plano.ativo) {
      throw Erros.planoInativo();
    }
    return plano;
  }
}

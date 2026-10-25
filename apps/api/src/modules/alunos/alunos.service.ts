import { calcularIdade } from './alunos.idade';
import { EmailAlunoDuplicadoError } from './alunos.repository';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type { Aluno, AlunosRepository } from './alunos.repository';
import type { AtualizarAlunoBody, CriarAlunoBody, ListarAlunosQuery } from './alunos.schemas';
import type { Paginated } from '../../shared/http/pagination';
import type { ConvitesRepository } from '../convites/convites.repository';

const MENSAGEM_NAO_ENCONTRADO = 'Aluno não encontrado.';
const MENSAGEM_EMAIL_EM_USO = 'Já existe um aluno cadastrado com este e-mail.';

export interface PerfilAluno {
  aluno: Aluno;
  idade: number;
}

const alunoJaAtivo = (): AppError => new AppError(409, 'ALUNO_JA_ATIVO', 'O aluno já está ativo.');
const alunoJaInativo = (): AppError =>
  new AppError(409, 'ALUNO_JA_INATIVO', 'O aluno já está inativo.');

/**
 * Converte erros conhecidos do repositório em AppError (resposta clara ao cliente).
 * Qualquer outro erro segue adiante e o errorHandler responde 500 e registra no log.
 */
function traduzirErro(error: unknown): unknown {
  if (error instanceof EmailAlunoDuplicadoError) {
    return AppError.conflict(MENSAGEM_EMAIL_EM_USO);
  }
  return error;
}

/** Regras de negócio de alunos (BE-ALU-01/02/03). Não conhece HTTP/Express. */
export class AlunosService {
  private readonly repository: AlunosRepository;

  private readonly convites: ConvitesRepository;

  constructor(repository: AlunosRepository, convites: ConvitesRepository) {
    this.repository = repository;
    this.convites = convites;
  }

  async criar(profissionalId: string, dados: CriarAlunoBody): Promise<Aluno> {
    try {
      return await this.repository.create({
        profissionalId,
        nome: dados.nome,
        sexo: dados.sexo,
        dataNascimento: dados.dataNascimento,
        email: dados.email ?? null,
        telefone: dados.telefone ?? null,
      });
    } catch (error) {
      throw traduzirErro(error);
    }
  }

  async buscarPorId(profissionalId: string, id: string): Promise<Aluno> {
    const aluno = await this.repository.findById(profissionalId, id);
    if (!aluno) {
      throw AppError.notFound(MENSAGEM_NAO_ENCONTRADO);
    }
    return aluno;
  }

  async atualizar(profissionalId: string, id: string, dados: AtualizarAlunoBody): Promise<Aluno> {
    let aluno: Aluno | null;
    try {
      aluno = await this.repository.update(profissionalId, id, dados);
    } catch (error) {
      throw traduzirErro(error);
    }

    if (!aluno) {
      throw AppError.notFound(MENSAGEM_NAO_ENCONTRADO);
    }
    return aluno;
  }

  async listar(profissionalId: string, query: ListarAlunosQuery): Promise<Paginated<Aluno>> {
    const { items, total } = await this.repository.list(profissionalId, {
      q: query.q,
      ativo: query.ativo,
      sexo: query.sexo,
      sort: query.sort,
      ...toSkipTake(query),
    });
    return paginate(items, total, query);
  }

  /** BE-ALU-03 · Perfil do aluno. A idade é calculada na hora, nunca guardada. */
  async perfil(profissionalId: string, id: string): Promise<PerfilAluno> {
    const aluno = await this.buscarPorId(profissionalId, id);
    return { aluno, idade: calcularIdade(aluno.dataNascimento) };
  }

  /**
   * BE-ALU-02 · Desativa sem apagar nada: anamneses, feedbacks, fotos e medidas
   * continuam guardados. O convite ainda válido é revogado para o link parar de
   * funcionar. Revoga antes de desativar: se algo falhar no meio, o pior caso é
   * um convite revogado à toa (basta reenviar), nunca um aluno inativo com link vivo.
   * Com o Prisma, os dois passos vão numa transação.
   */
  async desativar(profissionalId: string, id: string): Promise<Aluno> {
    const aluno = await this.buscarPorId(profissionalId, id);
    if (!aluno.ativo) {
      throw alunoJaInativo();
    }

    await this.convites.revogarValidos(id, new Date());
    return this.definirAtivo(profissionalId, id, false);
  }

  /** BE-ALU-02 · Reativa o aluno. O histórico volta a aparecer como estava. */
  async ativar(profissionalId: string, id: string): Promise<Aluno> {
    const aluno = await this.buscarPorId(profissionalId, id);
    if (aluno.ativo) {
      throw alunoJaAtivo();
    }

    return this.definirAtivo(profissionalId, id, true);
  }

  private async definirAtivo(profissionalId: string, id: string, ativo: boolean): Promise<Aluno> {
    const aluno = await this.repository.definirAtivo(profissionalId, id, ativo);
    if (!aluno) {
      throw AppError.notFound(MENSAGEM_NAO_ENCONTRADO);
    }
    return aluno;
  }
}

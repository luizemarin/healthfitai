import { EmailAlunoDuplicadoError } from './alunos.repository';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type { Aluno, AlunosRepository } from './alunos.repository';
import type { AtualizarAlunoBody, CriarAlunoBody, ListarAlunosQuery } from './alunos.schemas';
import type { Paginated } from '../../shared/http/pagination';

const MENSAGEM_NAO_ENCONTRADO = 'Aluno não encontrado.';
const MENSAGEM_EMAIL_EM_USO = 'Já existe um aluno cadastrado com este e-mail.';

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

/** Regras de negócio de alunos (BE-ALU-01). Não conhece HTTP/Express. */
export class AlunosService {
  private readonly repository: AlunosRepository;

  constructor(repository: AlunosRepository) {
    this.repository = repository;
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
}

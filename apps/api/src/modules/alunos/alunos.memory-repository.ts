import { randomUUID } from 'node:crypto';

import { EmailAlunoDuplicadoError } from './alunos.repository';

import type {
  AlteracoesAluno,
  Aluno,
  AlunosRepository,
  FiltrosListagemAlunos,
  NovoAluno,
  PaginaAlunos,
} from './alunos.repository';

/**
 * Implementação em memória, PROVISÓRIA até a tabela alunos (DB-004).
 * Os dados somem ao reiniciar a API. Imita o banco: gera o UUID (o Postgres
 * fará isso com gen_random_uuid()) e barra e-mail repetido por profissional.
 */
export class InMemoryAlunosRepository implements AlunosRepository {
  private readonly alunos = new Map<string, Aluno>();

  async create(dados: NovoAluno): Promise<Aluno> {
    this.garantirEmailUnico(dados.profissionalId, dados.email);

    const agora = new Date();
    const aluno: Aluno = {
      ...dados,
      id: randomUUID(),
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.alunos.set(aluno.id, aluno);

    return structuredClone(aluno);
  }

  async findById(profissionalId: string, id: string): Promise<Aluno | null> {
    const aluno = this.buscar(profissionalId, id);
    return aluno ? structuredClone(aluno) : null;
  }

  async update(
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesAluno,
  ): Promise<Aluno | null> {
    const aluno = this.buscar(profissionalId, id);
    if (!aluno) {
      return null;
    }

    if (alteracoes.email !== undefined) {
      this.garantirEmailUnico(profissionalId, alteracoes.email, id);
    }

    const definidas = Object.fromEntries(
      Object.entries(alteracoes).filter(([, valor]) => valor !== undefined),
    );
    const atualizado: Aluno = { ...aluno, ...definidas, atualizadoEm: new Date() };
    this.alunos.set(id, atualizado);

    return structuredClone(atualizado);
  }

  async list(profissionalId: string, filtros: FiltrosListagemAlunos): Promise<PaginaAlunos> {
    const termo = filtros.q?.toLowerCase();

    const encontrados = [...this.alunos.values()].filter(
      (aluno) =>
        aluno.profissionalId === profissionalId &&
        (filtros.ativo === undefined || aluno.ativo === filtros.ativo) &&
        (filtros.sexo === undefined || aluno.sexo === filtros.sexo) &&
        (termo === undefined ||
          aluno.nome.toLowerCase().includes(termo) ||
          (aluno.email?.includes(termo) ?? false)),
    );

    const { field, direction } = filtros.sort;
    const sinal = direction === 'asc' ? 1 : -1;
    encontrados.sort((a, b) => {
      const comparacao =
        field === 'nome'
          ? a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
          : a.criadoEm.getTime() - b.criadoEm.getTime();
      // Desempate pelo id: a ordem fica estável entre páginas.
      return sinal * comparacao || a.id.localeCompare(b.id);
    });

    return {
      items: encontrados
        .slice(filtros.skip, filtros.skip + filtros.take)
        .map((aluno) => structuredClone(aluno)),
      total: encontrados.length,
    };
  }

  async definirAtivo(profissionalId: string, id: string, ativo: boolean): Promise<Aluno | null> {
    const aluno = this.buscar(profissionalId, id);
    if (!aluno) {
      return null;
    }

    const atualizado: Aluno = { ...aluno, ativo, atualizadoEm: new Date() };
    this.alunos.set(id, atualizado);

    return structuredClone(atualizado);
  }

  private buscar(profissionalId: string, id: string): Aluno | undefined {
    const aluno = this.alunos.get(id);
    return aluno?.profissionalId === profissionalId ? aluno : undefined;
  }

  private garantirEmailUnico(
    profissionalId: string,
    email: string | null,
    ignorarId?: string,
  ): void {
    if (email === null) {
      return;
    }
    const emUso = [...this.alunos.values()].some(
      (aluno) =>
        aluno.profissionalId === profissionalId && aluno.email === email && aluno.id !== ignorarId,
    );
    if (emUso) {
      throw new EmailAlunoDuplicadoError();
    }
  }
}

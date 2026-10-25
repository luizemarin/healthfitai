import { randomUUID } from 'node:crypto';

import { statusDoConvite } from './convites.repository';

import type { Convite, ConvitesRepository, NovoConvite } from './convites.repository';

/**
 * Implementação em memória, PROVISÓRIA até o repositório com Prisma (tabela
 * convites, DB-005). Os dados somem ao reiniciar a API. Imita o banco: gera o
 * UUID (o Postgres fará isso com gen_random_uuid()) e nunca apaga registros.
 */
export class InMemoryConvitesRepository implements ConvitesRepository {
  private readonly convites = new Map<string, Convite>();

  async create(dados: NovoConvite): Promise<Convite> {
    const convite: Convite = {
      ...dados,
      id: randomUUID(),
      usadoEm: null,
      revogadoEm: null,
      criadoEm: new Date(),
    };
    this.convites.set(convite.id, convite);

    return structuredClone(convite);
  }

  async listByAluno(alunoId: string): Promise<Convite[]> {
    return this.doAluno(alunoId)
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      .map((convite) => structuredClone(convite));
  }

  async findValidoByAluno(alunoId: string, agora: Date): Promise<Convite | null> {
    const valido = this.doAluno(alunoId).find(
      (convite) => statusDoConvite(convite, agora) === 'valido',
    );
    return valido ? structuredClone(valido) : null;
  }

  async revogarValidos(alunoId: string, agora: Date): Promise<number> {
    const validos = this.doAluno(alunoId).filter(
      (convite) => statusDoConvite(convite, agora) === 'valido',
    );
    validos.forEach((convite) => {
      this.convites.set(convite.id, { ...convite, revogadoEm: agora });
    });
    return validos.length;
  }

  private doAluno(alunoId: string): Convite[] {
    return [...this.convites.values()].filter((convite) => convite.alunoId === alunoId);
  }
}

import { randomUUID } from 'node:crypto';

import type {
  AlteracoesExercicio,
  Exercicio,
  ExerciciosRepository,
  FiltrosListagemExercicios,
  NovoExercicio,
  PaginaExercicios,
} from './exercicios.repository';

/** Compara textos sem diferenciar maiúsculas, acentos e espaços nas pontas. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma (tabela exercicios). Os
 * dados somem ao reiniciar a API. Imita o banco: gera os UUIDs e exclusão é
 * lógica (ativo = false), nada é apagado.
 */
export class InMemoryExerciciosRepository implements ExerciciosRepository {
  private readonly exercicios = new Map<string, Exercicio>();

  async create(dados: NovoExercicio): Promise<Exercicio> {
    const agora = new Date();
    const exercicio: Exercicio = {
      ...dados,
      id: randomUUID(),
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.exercicios.set(exercicio.id, exercicio);
    return structuredClone(exercicio);
  }

  async findById(profissionalId: string, id: string): Promise<Exercicio | null> {
    const exercicio = this.buscarAtivo(profissionalId, id);
    return exercicio ? structuredClone(exercicio) : null;
  }

  async findByIds(profissionalId: string, ids: readonly string[]): Promise<Exercicio[]> {
    return ids.flatMap((id) => {
      const exercicio = this.exercicios.get(id);
      return exercicio?.profissionalId === profissionalId ? [structuredClone(exercicio)] : [];
    });
  }

  async list(
    profissionalId: string,
    filtros: FiltrosListagemExercicios,
  ): Promise<PaginaExercicios> {
    const termo = filtros.q === undefined ? undefined : normalizar(filtros.q);
    const grupo =
      filtros.grupoMuscular === undefined ? undefined : normalizar(filtros.grupoMuscular);

    const encontrados = [...this.exercicios.values()].filter(
      (exercicio) =>
        exercicio.profissionalId === profissionalId &&
        exercicio.ativo &&
        (grupo === undefined || normalizar(exercicio.grupoMuscular) === grupo) &&
        (termo === undefined ||
          normalizar(exercicio.nome).includes(termo) ||
          normalizar(exercicio.grupoMuscular).includes(termo)),
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
        .map((exercicio) => structuredClone(exercicio)),
      total: encontrados.length,
    };
  }

  async findAtivoPorNome(profissionalId: string, nome: string): Promise<Exercicio | null> {
    const alvo = normalizar(nome);
    const exercicio = [...this.exercicios.values()].find(
      (item) =>
        item.profissionalId === profissionalId && item.ativo && normalizar(item.nome) === alvo,
    );
    return exercicio ? structuredClone(exercicio) : null;
  }

  async update(
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesExercicio,
  ): Promise<Exercicio | null> {
    const exercicio = this.buscarAtivo(profissionalId, id);
    if (!exercicio) {
      return null;
    }

    // undefined = não alterar (null é valor válido: limpa o campo).
    const definidas = Object.fromEntries(
      Object.entries(alteracoes).filter(([, valor]) => valor !== undefined),
    );
    const atualizado: Exercicio = { ...exercicio, ...definidas, atualizadoEm: new Date() };
    this.exercicios.set(id, atualizado);

    return structuredClone(atualizado);
  }

  async desativar(profissionalId: string, id: string): Promise<boolean> {
    const exercicio = this.buscarAtivo(profissionalId, id);
    if (!exercicio) {
      return false;
    }
    this.exercicios.set(id, { ...exercicio, ativo: false, atualizadoEm: new Date() });
    return true;
  }

  private buscarAtivo(profissionalId: string, id: string): Exercicio | undefined {
    const exercicio = this.exercicios.get(id);
    return exercicio?.profissionalId === profissionalId && exercicio.ativo ? exercicio : undefined;
  }
}

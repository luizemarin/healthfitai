import { randomUUID } from 'node:crypto';

import type {
  AlteracoesPlano,
  FiltrosListagemPlanos,
  NovaRefeicaoPlano,
  NovoPlanoNutricional,
  NutricaoRepository,
  PaginaPlanos,
  PlanoNutricional,
} from './nutricao.repository';

/** Compara textos sem diferenciar maiúsculas, acentos e espaços nas pontas. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Gera os ids das refeições e garante a ordem (o banco devolve ordenado pelo índice único). */
function comIds(refeicoes: NovaRefeicaoPlano[]): PlanoNutricional['refeicoes'] {
  return refeicoes
    .map((refeicao) => ({ ...refeicao, id: randomUUID() }))
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma (tabelas planos_nutricionais
 * e planos_nutricionais_itens). Os dados somem ao reiniciar a API. Imita o banco:
 * gera os UUIDs e nada é apagado (plano antigo fica com ativo = false).
 */
export class InMemoryNutricaoRepository implements NutricaoRepository {
  private readonly planos = new Map<string, PlanoNutricional>();

  async criarPlano(dados: NovoPlanoNutricional): Promise<PlanoNutricional> {
    const agora = new Date();

    // Mesmo passo da transação no banco: desativa o plano atual antes de criar o novo.
    this.planos.forEach((plano, id) => {
      if (plano.alunoId === dados.alunoId && plano.ativo) {
        this.planos.set(id, { ...plano, ativo: false, atualizadoEm: agora });
      }
    });

    const plano: PlanoNutricional = {
      id: randomUUID(),
      alunoId: dados.alunoId,
      nome: dados.nome,
      observacoes: dados.observacoes,
      ativo: true,
      refeicoes: comIds(dados.refeicoes),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.planos.set(plano.id, plano);
    return structuredClone(plano);
  }

  async buscarPlano(id: string): Promise<PlanoNutricional | null> {
    const plano = this.planos.get(id);
    return plano ? structuredClone(plano) : null;
  }

  async buscarPlanoAtivo(alunoId: string): Promise<PlanoNutricional | null> {
    const plano = [...this.planos.values()].find((item) => item.alunoId === alunoId && item.ativo);
    return plano ? structuredClone(plano) : null;
  }

  async listarPlanos(alunoId: string, filtros: FiltrosListagemPlanos): Promise<PaginaPlanos> {
    const termo = filtros.q === undefined ? undefined : normalizar(filtros.q);

    const encontrados = [...this.planos.values()].filter(
      (plano) =>
        plano.alunoId === alunoId &&
        (filtros.ativo === undefined || plano.ativo === filtros.ativo) &&
        (termo === undefined || normalizar(plano.nome).includes(termo)),
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
        .map((plano) => structuredClone(plano)),
      total: encontrados.length,
    };
  }

  async atualizarPlano(id: string, alteracoes: AlteracoesPlano): Promise<PlanoNutricional | null> {
    const plano = this.planos.get(id);
    if (!plano?.ativo) {
      return null;
    }

    const atualizado: PlanoNutricional = {
      ...plano,
      nome: alteracoes.nome ?? plano.nome,
      observacoes:
        alteracoes.observacoes === undefined ? plano.observacoes : alteracoes.observacoes,
      refeicoes:
        alteracoes.refeicoes === undefined ? plano.refeicoes : comIds(alteracoes.refeicoes),
      atualizadoEm: new Date(),
    };
    this.planos.set(id, atualizado);
    return structuredClone(atualizado);
  }

  async desativarPlano(id: string): Promise<boolean> {
    const plano = this.planos.get(id);
    if (!plano?.ativo) {
      return false;
    }
    this.planos.set(id, { ...plano, ativo: false, atualizadoEm: new Date() });
    return true;
  }
}

import { randomUUID } from 'node:crypto';

import { TIPOS_MEDIDA_PADRAO } from './medidas.padroes';

import type { TipoMedidaPadrao } from './medidas.padroes';
import type {
  AlteracoesTipoMedida,
  FiltrosHistorico,
  FiltrosHistoricoMedidas,
  MedidasRepository,
  NovoRegistroMedida,
  NovoRegistroPeso,
  NovoTipoMedida,
  Pagina,
  RegistroMedida,
  RegistroPeso,
  TipoMedida,
} from './medidas.repository';

interface RegistroDatado {
  dataRegistro: string;
  criadoEm: Date;
}

/** Filtra por período, ordena por data (e criadoEm no mesmo dia) e pagina. */
function paginarHistorico<T extends RegistroDatado>(
  registros: T[],
  filtros: FiltrosHistorico,
): Pagina<T> {
  const sinal = filtros.direcao === 'asc' ? 1 : -1;
  const filtrados = registros
    .filter(
      (registro) =>
        (filtros.de === undefined || registro.dataRegistro >= filtros.de) &&
        (filtros.ate === undefined || registro.dataRegistro <= filtros.ate),
    )
    // Datas AAAA-MM-DD ordenam corretamente como texto.
    .sort(
      (a, b) =>
        sinal *
        (a.dataRegistro.localeCompare(b.dataRegistro) ||
          a.criadoEm.getTime() - b.criadoEm.getTime()),
    );

  return {
    items: filtrados
      .slice(filtros.skip, filtros.skip + filtros.take)
      .map((registro) => structuredClone(registro)),
    total: filtrados.length,
  };
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma (tabelas registros_peso,
 * tipos_medida e registros_medida). Os dados somem ao reiniciar a API. Imita o
 * banco: gera os UUIDs e nunca altera um registro já criado. Os tipos padrão
 * vêm da mesma lista do seed.
 */
export class InMemoryMedidasRepository implements MedidasRepository {
  private readonly tipos = new Map<string, TipoMedida>();

  private readonly pesos = new Map<string, RegistroPeso>();

  private readonly medidas = new Map<string, RegistroMedida>();

  private readonly padroes: readonly TipoMedidaPadrao[];

  constructor(padroes: readonly TipoMedidaPadrao[] = TIPOS_MEDIDA_PADRAO) {
    this.padroes = padroes;
  }

  // ─── Tipos de medida ──────────────────────────────────────────────────────

  async garantirTiposIniciais(profissionalId: string): Promise<void> {
    const jaTem = [...this.tipos.values()].some((tipo) => tipo.profissionalId === profissionalId);
    if (jaTem) {
      return;
    }
    this.padroes.forEach((padrao) => {
      this.inserirTipo({ profissionalId, nome: padrao.nome, unidade: padrao.unidade });
    });
  }

  async listarTipos(profissionalId: string): Promise<TipoMedida[]> {
    // O Map preserva a ordem de inserção = ordem de criação.
    return [...this.tipos.values()]
      .filter((tipo) => tipo.profissionalId === profissionalId)
      .map((tipo) => structuredClone(tipo));
  }

  async criarTipo(dados: NovoTipoMedida): Promise<TipoMedida> {
    return structuredClone(this.inserirTipo(dados));
  }

  async atualizarTipo(
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesTipoMedida,
  ): Promise<TipoMedida | null> {
    const tipo = this.tipos.get(id);
    if (tipo?.profissionalId !== profissionalId) {
      return null;
    }
    const atualizado: TipoMedida = { ...tipo, ...alteracoes, atualizadoEm: new Date() };
    this.tipos.set(id, atualizado);
    return structuredClone(atualizado);
  }

  async tipoTemRegistros(tipoId: string): Promise<boolean> {
    return [...this.medidas.values()].some((registro) => registro.tipoId === tipoId);
  }

  // ─── Registros ────────────────────────────────────────────────────────────

  async criarRegistroPeso(dados: NovoRegistroPeso): Promise<RegistroPeso> {
    const registro: RegistroPeso = { ...dados, id: randomUUID(), criadoEm: new Date() };
    this.pesos.set(registro.id, registro);
    return structuredClone(registro);
  }

  async listarRegistrosPeso(
    alunoId: string,
    filtros: FiltrosHistorico,
  ): Promise<Pagina<RegistroPeso>> {
    const doAluno = [...this.pesos.values()].filter((registro) => registro.alunoId === alunoId);
    return paginarHistorico(doAluno, filtros);
  }

  async criarRegistrosMedida(dados: readonly NovoRegistroMedida[]): Promise<RegistroMedida[]> {
    const criadoEm = new Date();
    const registros = dados.map((item) => ({ ...item, id: randomUUID(), criadoEm }));
    registros.forEach((registro) => this.medidas.set(registro.id, registro));
    return registros.map((registro) => structuredClone(registro));
  }

  async listarRegistrosMedida(
    alunoId: string,
    filtros: FiltrosHistoricoMedidas,
  ): Promise<Pagina<RegistroMedida>> {
    const doAluno = [...this.medidas.values()].filter(
      (registro) =>
        registro.alunoId === alunoId &&
        (filtros.tipoId === undefined || registro.tipoId === filtros.tipoId),
    );
    return paginarHistorico(doAluno, filtros);
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private inserirTipo(dados: NovoTipoMedida): TipoMedida {
    const agora = new Date();
    const tipo: TipoMedida = {
      ...dados,
      id: randomUUID(),
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.tipos.set(tipo.id, tipo);
    return tipo;
  }
}

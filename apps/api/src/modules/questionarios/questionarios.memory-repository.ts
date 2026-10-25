import { randomUUID } from 'node:crypto';

import { VersaoDesatualizadaError } from './questionarios.repository';

import type {
  EdicaoModelo,
  FiltrosListagemModelos,
  ModeloQuestionario,
  NovaPergunta,
  NovoModelo,
  PaginaModelos,
  QuestionariosRepository,
  ResumoVersao,
  VersaoModelo,
} from './questionarios.repository';

/** Cabeçalho do modelo; as perguntas ficam nas versões. */
type ModeloGuardado = Omit<ModeloQuestionario, 'perguntas'>;

/** O profissional vê os modelos dele e os padrão do sistema. */
function visivel(modelo: ModeloGuardado, profissionalId: string): boolean {
  return modelo.profissionalId === null || modelo.profissionalId === profissionalId;
}

/** Cria a foto de uma versão: cada pergunta ganha o próprio UUID. */
function novaVersao(
  modeloId: string,
  numero: number,
  perguntas: NovaPergunta[],
  criadoEm: Date,
): VersaoModelo {
  return {
    id: randomUUID(),
    modeloId,
    numero,
    perguntas: perguntas.map((pergunta) => ({ id: randomUUID(), ...pergunta })),
    criadoEm,
  };
}

/**
 * Implementação em memória, PROVISÓRIA até as tabelas no banco.
 * Os dados somem ao reiniciar a API. Imita o banco: gera os UUIDs (o Postgres
 * fará isso com gen_random_uuid()) e nunca altera uma versão já criada.
 */
export class InMemoryQuestionariosRepository implements QuestionariosRepository {
  private readonly modelos = new Map<string, ModeloGuardado>();

  /** modeloId → versões em ordem (índice 0 = versão 1). */
  private readonly versoes = new Map<string, VersaoModelo[]>();

  async create(dados: NovoModelo): Promise<ModeloQuestionario> {
    const agora = new Date();
    const modelo: ModeloGuardado = {
      id: randomUUID(),
      profissionalId: dados.profissionalId,
      tipo: dados.tipo,
      nome: dados.nome,
      sexoAlvo: dados.sexoAlvo,
      versao: 1,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    this.modelos.set(modelo.id, modelo);
    this.versoes.set(modelo.id, [novaVersao(modelo.id, 1, dados.perguntas, agora)]);

    return this.montar(modelo);
  }

  async findById(profissionalId: string, id: string): Promise<ModeloQuestionario | null> {
    const modelo = this.modelos.get(id);
    if (!modelo || !visivel(modelo, profissionalId)) {
      return null;
    }
    return this.montar(modelo);
  }

  async list(profissionalId: string, filtros: FiltrosListagemModelos): Promise<PaginaModelos> {
    const termo = filtros.q?.toLowerCase();

    const encontrados = [...this.modelos.values()].filter(
      (modelo) =>
        visivel(modelo, profissionalId) &&
        (filtros.tipo === undefined || modelo.tipo === filtros.tipo) &&
        (filtros.ativo === undefined || modelo.ativo === filtros.ativo) &&
        (termo === undefined || modelo.nome.toLowerCase().includes(termo)),
    );

    const { field, direction } = filtros.sort;
    const sinal = direction === 'asc' ? 1 : -1;
    encontrados.sort((a, b) => {
      const comparacao =
        field === 'nome'
          ? a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
          : a[field].getTime() - b[field].getTime();
      // Desempate pelo id: a ordem fica estável entre páginas.
      return sinal * comparacao || a.id.localeCompare(b.id);
    });

    return {
      items: encontrados
        .slice(filtros.skip, filtros.skip + filtros.take)
        .map((modelo) => this.montar(modelo)),
      total: encontrados.length,
    };
  }

  async update(
    profissionalId: string,
    id: string,
    edicao: EdicaoModelo,
  ): Promise<ModeloQuestionario | null> {
    const modelo = this.modelos.get(id);
    if (modelo?.profissionalId !== profissionalId) {
      return null;
    }
    if (modelo.versao !== edicao.versaoEsperada) {
      throw new VersaoDesatualizadaError(modelo.versao);
    }

    const agora = new Date();
    let { versao } = modelo;

    if (edicao.novasPerguntas) {
      versao += 1;
      this.versoes.get(id)?.push(novaVersao(id, versao, edicao.novasPerguntas, agora));
    }

    const atualizado: ModeloGuardado = {
      ...modelo,
      nome: edicao.nome,
      sexoAlvo: edicao.sexoAlvo,
      versao,
      atualizadoEm: agora,
    };
    this.modelos.set(id, atualizado);

    return this.montar(atualizado);
  }

  async definirAtivo(
    profissionalId: string,
    id: string,
    ativo: boolean,
  ): Promise<ModeloQuestionario | null> {
    const modelo = this.modelos.get(id);
    if (modelo?.profissionalId !== profissionalId) {
      return null;
    }

    const atualizado: ModeloGuardado = { ...modelo, ativo, atualizadoEm: new Date() };
    this.modelos.set(id, atualizado);

    return this.montar(atualizado);
  }

  async listVersoes(modeloId: string): Promise<ResumoVersao[]> {
    return (this.versoes.get(modeloId) ?? [])
      .map((versao) => ({
        numero: versao.numero,
        criadoEm: new Date(versao.criadoEm),
        totalPerguntas: versao.perguntas.length,
      }))
      .reverse();
  }

  async findVersao(modeloId: string, numero: number): Promise<VersaoModelo | null> {
    const versao = this.versoes.get(modeloId)?.find((item) => item.numero === numero);
    return versao ? structuredClone(versao) : null;
  }

  /** Junta o cabeçalho com as perguntas da versão atual (cópia, nunca a referência). */
  private montar(modelo: ModeloGuardado): ModeloQuestionario {
    const atual = this.versoes.get(modelo.id)?.find((item) => item.numero === modelo.versao);
    return structuredClone({ ...modelo, perguntas: atual?.perguntas ?? [] });
  }
}

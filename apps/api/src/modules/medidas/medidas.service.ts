import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';
import { hojeEmBrasilia } from '../fotos/fotos.schemas';

import type {
  MedidasRepository,
  Papel,
  RegistroMedida,
  RegistroPeso,
  TipoMedida,
} from './medidas.repository';
import type {
  EditarTipoBody,
  ListarMedidasQuery,
  ListarPesosQuery,
  RegistrarMedidasBody,
  RegistrarPesoBody,
  Unidade,
} from './medidas.schemas';
import type { ErrorDetail } from '../../shared/errors/app-error';
import type { Paginated } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';

/** BE-MED-02 · Limite de tipos ativos por profissional (a tela de lançamento mostra todos). */
export const MAX_TIPOS_ATIVOS = 30;

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: () =>
    new AppError(
      409,
      'ALUNO_INATIVO',
      'O aluno está inativo. Reative o aluno para registrar peso ou medidas.',
    ),
  tipoNaoEncontrado: (details?: ErrorDetail[]) =>
    new AppError(404, 'NOT_FOUND', 'Tipo de medida não encontrado.', details),
  tipoInativo: (nome: string, details?: ErrorDetail[]) =>
    new AppError(
      409,
      'TIPO_MEDIDA_INATIVO',
      `O tipo de medida "${nome}" está desativado. Ative o tipo ou escolha outro.`,
      details,
    ),
  tipoJaAtivo: () => new AppError(409, 'TIPO_MEDIDA_JA_ATIVO', 'O tipo de medida já está ativo.'),
  tipoJaInativo: () =>
    new AppError(409, 'TIPO_MEDIDA_JA_INATIVO', 'O tipo de medida já está desativado.'),
  tipoDuplicado: (nome: string) =>
    new AppError(
      409,
      'TIPO_MEDIDA_DUPLICADO',
      `Já existe um tipo de medida ativo chamado "${nome}".`,
    ),
  limiteTipos: () =>
    new AppError(
      409,
      'LIMITE_TIPOS_MEDIDA',
      `Você pode ter no máximo ${MAX_TIPOS_ATIVOS} tipos de medida ativos. Desative um antes de adicionar outro.`,
    ),
  unidadeComRegistros: (tipo: TipoMedida) =>
    new AppError(
      409,
      'TIPO_MEDIDA_COM_REGISTROS',
      `"${tipo.nome}" já tem medidas registradas em ${tipo.unidade}, por isso a unidade não pode mudar. ` +
        'Para medir em outra unidade, crie um novo tipo.',
    ),
  percentualAcimaDe100: (details: ErrorDetail[]) =>
    AppError.validation(details, 'Medidas em % devem ser de no máximo 100.'),
};

/** Mesmo nome = ignora maiúsculas, acentos e espaços nas pontas ("Cintura" = " cintura "). */
function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
}

function encontrarTipo(tipos: TipoMedida[], id: string): TipoMedida {
  const tipo = tipos.find((item) => item.id === id);
  if (!tipo) {
    throw Erros.tipoNaoEncontrado();
  }
  return tipo;
}

/** Antes de criar ou reativar: nome livre entre os ativos e limite de tipos. */
function garantirVagaENomeLivre(tipos: TipoMedida[], nome: string): void {
  const ativos = tipos.filter((tipo) => tipo.ativo);
  if (ativos.some((tipo) => mesmoNome(tipo.nome, nome))) {
    throw Erros.tipoDuplicado(nome);
  }
  if (ativos.length >= MAX_TIPOS_ATIVOS) {
    throw Erros.limiteTipos();
  }
}

/**
 * PROVISÓRIO: só o profissional é identificado hoje (X-Profissional-Id).
 * Com o login (BE-AUT), vira "aluno" quando o registro vier do app do aluno.
 */
function quemRegistra(): Papel {
  return 'profissional';
}

/** Registro de medida com o tipo junto, pronto para a resposta. */
export interface MedidaComTipo {
  registro: RegistroMedida;
  tipo: TipoMedida;
}

/** Junta cada registro ao seu tipo (os tipos são sempre do profissional do aluno). */
function comTipos(registros: RegistroMedida[], tipos: TipoMedida[]): MedidaComTipo[] {
  const tipoPorId = new Map(tipos.map((tipo) => [tipo.id, tipo]));
  return registros.flatMap((registro) => {
    const tipo = tipoPorId.get(registro.tipoId);
    return tipo ? [{ registro, tipo }] : [];
  });
}

/**
 * Peso e medidas do aluno.
 *   BE-MED-01 · registro de peso e medidas: histórico datado, nada é sobrescrito
 *   BE-MED-02 · tipos de medida configuráveis, cada um com sua unidade
 * Não conhece HTTP/Express.
 */
export class MedidasService {
  private readonly repository: MedidasRepository;

  private readonly alunos: AlunosRepository;

  constructor(repository: MedidasRepository, alunos: AlunosRepository) {
    this.repository = repository;
    this.alunos = alunos;
  }

  // ─── BE-MED-02 · Tipos de medida ──────────────────────────────────────────

  /** Na primeira vez, o profissional recebe a cópia dos tipos padrão. */
  async listarTipos(profissionalId: string, ativo?: boolean): Promise<TipoMedida[]> {
    const tipos = await this.tiposDoProfissional(profissionalId);
    return ativo === undefined ? tipos : tipos.filter((tipo) => tipo.ativo === ativo);
  }

  async criarTipo(profissionalId: string, nome: string, unidade: Unidade): Promise<TipoMedida> {
    const tipos = await this.tiposDoProfissional(profissionalId);
    garantirVagaENomeLivre(tipos, nome);

    return this.repository.criarTipo({ profissionalId, nome, unidade });
  }

  /**
   * Renomear é sempre permitido (o histórico passa a mostrar o nome novo).
   * Trocar a unidade só enquanto o tipo não tem registros: senão a mesma curva
   * misturaria valores em unidades diferentes.
   */
  async editarTipo(profissionalId: string, id: string, body: EditarTipoBody): Promise<TipoMedida> {
    const tipos = await this.tiposDoProfissional(profissionalId);
    const tipo = encontrarTipo(tipos, id);
    if (!tipo.ativo) {
      throw Erros.tipoInativo(tipo.nome);
    }

    const { nome, unidade } = body;
    if (
      nome !== undefined &&
      tipos.some((outro) => outro.ativo && outro.id !== id && mesmoNome(outro.nome, nome))
    ) {
      throw Erros.tipoDuplicado(nome);
    }
    if (
      unidade !== undefined &&
      unidade !== tipo.unidade &&
      (await this.repository.tipoTemRegistros(id))
    ) {
      throw Erros.unidadeComRegistros(tipo);
    }

    return this.atualizar(profissionalId, id, {
      ...(nome !== undefined && { nome }),
      ...(unidade !== undefined && { unidade }),
    });
  }

  /** "Remover" o tipo: some da tela de lançamento, mas o histórico continua no gráfico. */
  async desativarTipo(profissionalId: string, id: string): Promise<TipoMedida> {
    const tipo = encontrarTipo(await this.tiposDoProfissional(profissionalId), id);
    if (!tipo.ativo) {
      throw Erros.tipoJaInativo();
    }
    return this.atualizar(profissionalId, id, { ativo: false });
  }

  async ativarTipo(profissionalId: string, id: string): Promise<TipoMedida> {
    const tipos = await this.tiposDoProfissional(profissionalId);
    const tipo = encontrarTipo(tipos, id);
    if (tipo.ativo) {
      throw Erros.tipoJaAtivo();
    }
    garantirVagaENomeLivre(tipos, tipo.nome);

    return this.atualizar(profissionalId, id, { ativo: true });
  }

  // ─── BE-MED-01 · Peso ─────────────────────────────────────────────────────

  async registrarPeso(
    profissionalId: string,
    alunoId: string,
    body: RegistrarPesoBody,
  ): Promise<RegistroPeso> {
    await this.alunoAtivo(profissionalId, alunoId);

    return this.repository.criarRegistroPeso({
      alunoId,
      pesoKg: body.pesoKg,
      dataRegistro: body.dataRegistro ?? hojeEmBrasilia(),
      registradoPor: quemRegistra(),
    });
  }

  /** Histórico de pesagens. Aluno inativo continua consultável. */
  async listarPesos(
    profissionalId: string,
    alunoId: string,
    query: ListarPesosQuery,
  ): Promise<Paginated<RegistroPeso>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.listarRegistrosPeso(alunoId, {
      de: query.de,
      ate: query.ate,
      direcao: query.sort === 'dataRegistro' ? 'asc' : 'desc',
      ...toSkipTake(query),
    });

    return paginate(items, total, query);
  }

  // ─── BE-MED-01 · Medidas ──────────────────────────────────────────────────

  /**
   * Lançamento das medidas de um dia (várias de uma vez, uma por tipo).
   * Tudo é validado antes de gravar: ou entram todas, ou nenhuma.
   */
  async registrarMedidas(
    profissionalId: string,
    alunoId: string,
    body: RegistrarMedidasBody,
  ): Promise<MedidaComTipo[]> {
    await this.alunoAtivo(profissionalId, alunoId);
    const tipos = await this.tiposDoProfissional(profissionalId);

    // Resolve o tipo de cada item; o erro aponta o campo exato para o front.
    const itens = body.medidas.map((medida, indice) => {
      const field = `body.medidas.${indice}.tipoId`;
      const tipo = tipos.find((item) => item.id === medida.tipoId);
      if (!tipo) {
        throw Erros.tipoNaoEncontrado([
          { field, message: `O tipo de medida ${medida.tipoId} não existe.` },
        ]);
      }
      if (!tipo.ativo) {
        throw Erros.tipoInativo(tipo.nome, [
          { field, message: `O tipo "${tipo.nome}" está desativado.` },
        ]);
      }
      return { medida, tipo, indice };
    });

    const acimaDe100 = itens.filter(
      ({ medida, tipo }) => tipo.unidade === '%' && medida.valor > 100,
    );
    if (acimaDe100.length > 0) {
      throw Erros.percentualAcimaDe100(
        acimaDe100.map(({ tipo, indice }) => ({
          field: `body.medidas.${indice}.valor`,
          message: `"${tipo.nome}" é medido em % e deve ser de no máximo 100.`,
        })),
      );
    }

    const dataRegistro = body.dataRegistro ?? hojeEmBrasilia();
    const registradoPor = quemRegistra();
    const registros = await this.repository.criarRegistrosMedida(
      itens.map(({ medida }) => ({
        alunoId,
        tipoId: medida.tipoId,
        valor: medida.valor,
        dataRegistro,
        registradoPor,
      })),
    );

    return comTipos(registros, tipos);
  }

  /** Histórico de medidas (filtrando por tipo, é uma curva do gráfico). */
  async listarMedidas(
    profissionalId: string,
    alunoId: string,
    query: ListarMedidasQuery,
  ): Promise<Paginated<MedidaComTipo>> {
    await this.buscarAluno(profissionalId, alunoId);
    const tipos = await this.tiposDoProfissional(profissionalId);
    if (query.tipoId !== undefined) {
      encontrarTipo(tipos, query.tipoId);
    }

    const { items, total } = await this.repository.listarRegistrosMedida(alunoId, {
      tipoId: query.tipoId,
      de: query.de,
      ate: query.ate,
      direcao: query.sort === 'dataRegistro' ? 'asc' : 'desc',
      ...toSkipTake(query),
    });

    return paginate(comTipos(items, tipos), total, query);
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private async tiposDoProfissional(profissionalId: string): Promise<TipoMedida[]> {
    await this.repository.garantirTiposIniciais(profissionalId);
    return this.repository.listarTipos(profissionalId);
  }

  private async atualizar(
    profissionalId: string,
    id: string,
    alteracoes: Parameters<MedidasRepository['atualizarTipo']>[2],
  ): Promise<TipoMedida> {
    const tipo = await this.repository.atualizarTipo(profissionalId, id, alteracoes);
    if (!tipo) {
      throw Erros.tipoNaoEncontrado();
    }
    return tipo;
  }

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async alunoAtivo(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo();
    }
    return aluno;
  }
}

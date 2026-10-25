import { VersaoDesatualizadaError } from './questionarios.repository';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type {
  ModeloQuestionario,
  NovaPergunta,
  Pergunta,
  QuestionariosRepository,
  ResumoVersao,
  VersaoModelo,
} from './questionarios.repository';
import type {
  CriarModeloBody,
  DuplicarModeloBody,
  EditarModeloBody,
  ListarModelosQuery,
  PerguntaBody,
} from './questionarios.schemas';
import type { Paginated } from '../../shared/http/pagination';

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  modeloNaoEncontrado: () => AppError.notFound('Modelo de questionário não encontrado.'),
  versaoNaoEncontrada: (numero: number) =>
    AppError.notFound(`A versão ${numero} não existe para este modelo.`),
  modeloPadrao: () =>
    new AppError(
      403,
      'MODELO_PADRAO_SOMENTE_LEITURA',
      'Modelos padrão do sistema não podem ser alterados. Duplique o modelo para personalizar.',
    ),
  modeloInativo: () =>
    new AppError(409, 'MODELO_INATIVO', 'O modelo está inativo. Ative o modelo antes de editar.'),
  modeloJaAtivo: () => new AppError(409, 'MODELO_JA_ATIVO', 'O modelo já está ativo.'),
  modeloJaInativo: () => new AppError(409, 'MODELO_JA_INATIVO', 'O modelo já está inativo.'),
  modeloDesatualizado: (versaoAtual: number) =>
    new AppError(
      409,
      'MODELO_DESATUALIZADO',
      `Este modelo foi alterado depois que você o abriu (versão atual: ${versaoAtual}). ` +
        'Recarregue o modelo e refaça a edição.',
    ),
};

const NOME_MAXIMO = 120;
const SUFIXO_COPIA = ' (cópia)';

/** Converte a pergunta validada no formato do repositório. A ordem é a posição na lista. */
function toNovaPergunta(pergunta: PerguntaBody, indice: number): NovaPergunta {
  return {
    ordem: indice + 1,
    tipo: pergunta.tipo,
    enunciado: pergunta.enunciado,
    obrigatoria: pergunta.obrigatoria,
    exibirEvolucao: pergunta.exibirEvolucao,
    opcoes: 'opcoes' in pergunta ? pergunta.opcoes : null,
    unidade: 'unidade' in pergunta ? (pergunta.unidade ?? null) : null,
    min: 'min' in pergunta ? (pergunta.min ?? null) : null,
    max: 'max' in pergunta ? (pergunta.max ?? null) : null,
  };
}

/** Pergunta sem o id, com os campos sempre na mesma ordem (para comparar conteúdo). */
function semId(pergunta: Pergunta | NovaPergunta): NovaPergunta {
  return {
    ordem: pergunta.ordem,
    tipo: pergunta.tipo,
    enunciado: pergunta.enunciado,
    obrigatoria: pergunta.obrigatoria,
    exibirEvolucao: pergunta.exibirEvolucao,
    opcoes: pergunta.opcoes,
    unidade: pergunta.unidade,
    min: pergunta.min,
    max: pergunta.max,
  };
}

function mesmasPerguntas(atuais: Pergunta[], novas: NovaPergunta[]): boolean {
  return JSON.stringify(atuais.map(semId)) === JSON.stringify(novas.map(semId));
}

function nomeDaCopia(nomeOriginal: string): string {
  return nomeOriginal.slice(0, NOME_MAXIMO - SUFIXO_COPIA.length) + SUFIXO_COPIA;
}

/**
 * Motor único de questionários (anamnese, avaliação e feedback).
 *   BE-QST-01 · criar, listar, detalhar, editar, duplicar, desativar/ativar
 *   BE-QST-02 · tipos de pergunta (validados nos schemas)
 *   BE-QST-03 · flag "exibir no gráfico de evolução" (só numero/escala)
 *   BE-QST-04 · editar as perguntas cria uma versão nova; as antigas ficam intactas
 * Não conhece HTTP/Express.
 */
export class QuestionariosService {
  private readonly repository: QuestionariosRepository;

  constructor(repository: QuestionariosRepository) {
    this.repository = repository;
  }

  async criar(profissionalId: string, dados: CriarModeloBody): Promise<ModeloQuestionario> {
    return this.repository.create({
      profissionalId,
      tipo: dados.tipo,
      nome: dados.nome,
      sexoAlvo: dados.sexoAlvo,
      perguntas: dados.perguntas.map(toNovaPergunta),
    });
  }

  async listar(
    profissionalId: string,
    query: ListarModelosQuery,
  ): Promise<Paginated<ModeloQuestionario>> {
    const { items, total } = await this.repository.list(profissionalId, {
      q: query.q,
      tipo: query.tipo,
      ativo: query.ativo,
      sort: query.sort,
      ...toSkipTake(query),
    });
    return paginate(items, total, query);
  }

  async buscarPorId(profissionalId: string, id: string): Promise<ModeloQuestionario> {
    const modelo = await this.repository.findById(profissionalId, id);
    if (!modelo) {
      throw Erros.modeloNaoEncontrado();
    }
    return modelo;
  }

  /**
   * Edita nome, sexo-alvo e perguntas. Só gera versão nova se as perguntas
   * mudaram: renomear não mexe no que o aluno responde.
   */
  async editar(
    profissionalId: string,
    id: string,
    dados: EditarModeloBody,
  ): Promise<ModeloQuestionario> {
    const modelo = await this.buscarDoProfissional(profissionalId, id);
    if (!modelo.ativo) {
      throw Erros.modeloInativo();
    }
    if (modelo.versao !== dados.versao) {
      throw Erros.modeloDesatualizado(modelo.versao);
    }

    const novas = dados.perguntas.map(toNovaPergunta);

    let atualizado: ModeloQuestionario | null;
    try {
      atualizado = await this.repository.update(profissionalId, id, {
        nome: dados.nome,
        sexoAlvo: dados.sexoAlvo,
        versaoEsperada: dados.versao,
        novasPerguntas: mesmasPerguntas(modelo.perguntas, novas) ? null : novas,
      });
    } catch (error) {
      // Outra edição salvou entre a leitura acima e a gravação.
      if (error instanceof VersaoDesatualizadaError) {
        throw Erros.modeloDesatualizado(error.versaoAtual);
      }
      throw error;
    }

    if (!atualizado) {
      throw Erros.modeloNaoEncontrado();
    }
    return atualizado;
  }

  /**
   * Cria um modelo novo (versão 1) do profissional com as perguntas da versão
   * atual do original. Vale para modelos dele e para os padrão do sistema.
   * O original não é alterado.
   */
  async duplicar(
    profissionalId: string,
    id: string,
    dados: DuplicarModeloBody,
  ): Promise<ModeloQuestionario> {
    const original = await this.buscarPorId(profissionalId, id);

    return this.repository.create({
      profissionalId,
      tipo: original.tipo,
      nome: dados?.nome ?? nomeDaCopia(original.nome),
      sexoAlvo: original.sexoAlvo,
      perguntas: original.perguntas.map(semId),
    });
  }

  /** Desativa sem apagar: some das listas, mas as respostas antigas continuam ligadas a ele. */
  async desativar(profissionalId: string, id: string): Promise<ModeloQuestionario> {
    const modelo = await this.buscarDoProfissional(profissionalId, id);
    if (!modelo.ativo) {
      throw Erros.modeloJaInativo();
    }
    return this.definirAtivo(profissionalId, id, false);
  }

  async ativar(profissionalId: string, id: string): Promise<ModeloQuestionario> {
    const modelo = await this.buscarDoProfissional(profissionalId, id);
    if (modelo.ativo) {
      throw Erros.modeloJaAtivo();
    }
    return this.definirAtivo(profissionalId, id, true);
  }

  /** BE-QST-04 · Histórico de versões do modelo (mais recente primeiro). */
  async listarVersoes(profissionalId: string, id: string): Promise<ResumoVersao[]> {
    const modelo = await this.buscarPorId(profissionalId, id);
    return this.repository.listVersoes(modelo.id);
  }

  /** BE-QST-04 · Perguntas exatamente como estavam naquela versão. */
  async buscarVersao(profissionalId: string, id: string, numero: number): Promise<VersaoModelo> {
    const modelo = await this.buscarPorId(profissionalId, id);
    const versao = await this.repository.findVersao(modelo.id, numero);
    if (!versao) {
      throw Erros.versaoNaoEncontrada(numero);
    }
    return versao;
  }

  /** Modelo que o profissional pode alterar (o dele; padrão do sistema é só leitura). */
  private async buscarDoProfissional(
    profissionalId: string,
    id: string,
  ): Promise<ModeloQuestionario> {
    const modelo = await this.buscarPorId(profissionalId, id);
    if (modelo.profissionalId === null) {
      throw Erros.modeloPadrao();
    }
    return modelo;
  }

  private async definirAtivo(
    profissionalId: string,
    id: string,
    ativo: boolean,
  ): Promise<ModeloQuestionario> {
    const modelo = await this.repository.definirAtivo(profissionalId, id, ativo);
    if (!modelo) {
      throw Erros.modeloNaoEncontrado();
    }
    return modelo;
  }
}

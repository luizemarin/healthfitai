import { SubmissaoFinalizadaError } from './respostas.repository';
import { validarValor } from './respostas.valores';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type {
  AlteracaoResposta,
  PreenchidoPor,
  RespostasRepository,
  Submissao,
} from './respostas.repository';
import type {
  FinalizarSubmissaoBody,
  ListarSubmissoesQuery,
  RespostaInformadaBody,
} from './respostas.schemas';
import type { ErrorDetail } from '../../shared/errors/app-error';
import type { Paginated } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';
import type {
  ModeloQuestionario,
  Pergunta,
  QuestionariosRepository,
  TipoModelo,
} from '../questionarios/questionarios.repository';

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: () =>
    new AppError(
      409,
      'ALUNO_INATIVO',
      'O aluno está inativo. Reative o aluno para registrar respostas.',
    ),
  modeloNaoEncontrado: () => AppError.notFound('Modelo de questionário não encontrado.'),
  modeloInativo: () =>
    new AppError(
      409,
      'MODELO_INATIVO',
      'O modelo está inativo. Ative o modelo para iniciar um novo preenchimento.',
    ),
  submissaoNaoEncontrada: () => AppError.notFound('Questionário respondido não encontrado.'),
  submissaoFinalizada: () =>
    new AppError(
      409,
      'SUBMISSAO_FINALIZADA',
      'Este questionário já foi enviado e não pode mais ser alterado. ' +
        'Para responder de novo, inicie um novo preenchimento.',
    ),
  respostasInvalidas: (details: ErrorDetail[]) =>
    AppError.validation(details, 'Algumas respostas são inválidas. Corrija e tente de novo.'),
  obrigatoriasPendentes: (details: ErrorDetail[]) =>
    new AppError(
      400,
      'RESPOSTAS_OBRIGATORIAS_PENDENTES',
      `Responda as perguntas obrigatórias antes de enviar (${details.length} pendente(s)).`,
      details,
    ),
  dataNaoPermitida: () =>
    new AppError(
      400,
      'DATA_RESPOSTA_NAO_PERMITIDA',
      'A data da resposta só pode ser informada em avaliações preenchidas pelo profissional.',
    ),
  dataNoFuturo: () =>
    AppError.validation([
      { field: 'body.respondidoEm', message: 'A data da avaliação não pode estar no futuro.' },
    ]),
};

/** Folga para diferença de relógio entre o aparelho e o servidor. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/**
 * Quem preenche, pelo tipo do modelo: avaliação é do profissional (BE-RSP-03);
 * anamnese e feedback são do aluno.
 */
function quemPreenche(tipo: TipoModelo): PreenchidoPor {
  return tipo === 'avaliacao' ? 'profissional' : 'aluno';
}

/** Submissão com o que o front precisa para exibir: modelo e perguntas da versão respondida. */
export interface SubmissaoDetalhada {
  submissao: Submissao;
  modelo: Pick<ModeloQuestionario, 'id' | 'nome' | 'tipo'>;
  perguntas: Pergunta[];
}

export interface SubmissaoComModelo {
  submissao: Submissao;
  modelo: Pick<ModeloQuestionario, 'id' | 'nome' | 'tipo'>;
}

/** Não deveria acontecer: modelos nunca são apagados. Vira 500 e vai para o log. */
function semModelo(modeloId: string): never {
  throw new Error(`Modelo ${modeloId} de uma submissão não foi encontrado.`);
}

/**
 * Valida cada resposta contra a pergunta da versão. Junta todos os problemas
 * num único erro, com `field` apontando o item (ex.: body.respostas.2.valor).
 */
function validarRespostas(
  perguntas: Pergunta[],
  respostas: RespostaInformadaBody[],
): AlteracaoResposta[] {
  const porId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
  const details: ErrorDetail[] = [];
  const alteracoes: AlteracaoResposta[] = [];

  respostas.forEach(({ perguntaId, valor }, indice) => {
    const campo = `body.respostas.${indice}`;
    const pergunta = porId.get(perguntaId);

    if (!pergunta) {
      details.push({
        field: `${campo}.perguntaId`,
        message: 'Esta pergunta não faz parte deste questionário.',
      });
      return;
    }
    if (valor === null) {
      alteracoes.push({ perguntaId, valor: null });
      return;
    }

    const resultado = validarValor(pergunta, valor);
    if ('erro' in resultado) {
      details.push({
        field: `${campo}.valor`,
        message: `Pergunta ${pergunta.ordem}: ${resultado.erro}`,
      });
    } else {
      alteracoes.push({ perguntaId, valor: resultado.valor });
    }
  });

  if (details.length > 0) {
    throw Erros.respostasInvalidas(details);
  }
  return alteracoes;
}

function obrigatoriasPendentes(perguntas: Pergunta[], submissao: Submissao): ErrorDetail[] {
  const respondidas = new Set(submissao.respostas.map((resposta) => resposta.perguntaId));

  return perguntas
    .filter((pergunta) => pergunta.obrigatoria && !respondidas.has(pergunta.id))
    .map((pergunta) => ({
      field: `perguntas.${pergunta.id}`,
      message: `Pergunta ${pergunta.ordem} é obrigatória: "${pergunta.enunciado}".`,
    }));
}

/** BE-RSP-03 · Data da resposta: agora, ou a data da avaliação informada pelo profissional. */
function definirDataResposta(submissao: Submissao, informada: string | undefined): Date {
  if (informada === undefined) {
    return new Date();
  }
  if (submissao.preenchidoPor !== 'profissional') {
    throw Erros.dataNaoPermitida();
  }
  const data = new Date(informada);
  if (data.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
    throw Erros.dataNoFuturo();
  }
  return data;
}

/** Converte a corrida "outro aparelho enviou antes" e o "sumiu" em erros claros. */
async function tratarFinalizada(
  operacao: () => Promise<Submissao | null>,
): Promise<Submissao> {
  let resultado: Submissao | null;
  try {
    resultado = await operacao();
  } catch (error) {
    if (error instanceof SubmissaoFinalizadaError) {
      throw Erros.submissaoFinalizada();
    }
    throw error;
  }
  if (!resultado) {
    throw Erros.submissaoNaoEncontrada();
  }
  return resultado;
}

/**
 * Respostas dos questionários (anamnese, avaliação e feedback).
 *   BE-RSP-01 · cada envio vira um registro novo, datado e imutável
 *   BE-RSP-02 · rascunho com autosave; retomar de onde parou; rascunho não é resposta final
 *   BE-RSP-03 · avaliação preenchida pelo profissional, com a data da avaliação
 *   BE-RSP-04 · histórico do aluno por tipo, modelo e período
 * Não conhece HTTP/Express.
 */
export class RespostasService {
  private readonly repository: RespostasRepository;

  private readonly questionarios: QuestionariosRepository;

  private readonly alunos: AlunosRepository;

  constructor(
    repository: RespostasRepository,
    questionarios: QuestionariosRepository,
    alunos: AlunosRepository,
  ) {
    this.repository = repository;
    this.questionarios = questionarios;
    this.alunos = alunos;
  }

  /**
   * BE-RSP-02 · Abre um preenchimento. Se o aluno já tem um rascunho daquele
   * modelo, devolve o mesmo (retomar de onde parou) em vez de criar outro.
   * O rascunho fica preso à versão do modelo em que começou (BE-QST-04).
   */
  async abrir(
    profissionalId: string,
    alunoId: string,
    modeloId: string,
  ): Promise<SubmissaoDetalhada> {
    await this.buscarAlunoAtivo(profissionalId, alunoId);

    const modelo = await this.questionarios.findById(profissionalId, modeloId);
    if (!modelo) {
      throw Erros.modeloNaoEncontrado();
    }

    const rascunho = await this.repository.findRascunho(alunoId, modeloId);
    if (rascunho) {
      return this.detalhar(rascunho, modelo);
    }

    if (!modelo.ativo) {
      throw Erros.modeloInativo();
    }

    const criada = await this.repository.create({
      alunoId,
      modeloId,
      tipo: modelo.tipo,
      versao: modelo.versao,
      preenchidoPor: quemPreenche(modelo.tipo),
    });
    return this.detalhar(criada, modelo);
  }

  /**
   * BE-RSP-02 · Autosave. Grava só as perguntas enviadas (valor null apaga);
   * aceita respostas incompletas: obrigatórias só são cobradas ao enviar.
   */
  async salvarRascunho(
    profissionalId: string,
    alunoId: string,
    id: string,
    respostas: RespostaInformadaBody[],
  ): Promise<SubmissaoDetalhada> {
    await this.buscarAlunoAtivo(profissionalId, alunoId);
    const submissao = await this.buscarRascunho(alunoId, id);

    const perguntas = await this.perguntasDaVersao(submissao);
    const atualizada = await this.gravar(submissao.id, validarRespostas(perguntas, respostas));

    return this.detalhar(atualizada, await this.modeloDa(profissionalId, atualizada), perguntas);
  }

  /**
   * BE-RSP-01 · Envia: confere as obrigatórias e transforma o rascunho em
   * registro final, datado e somente leitura.
   * BE-RSP-03 · Em avaliação, o profissional pode informar a data em que avaliou.
   */
  async finalizar(
    profissionalId: string,
    alunoId: string,
    id: string,
    dados: FinalizarSubmissaoBody,
  ): Promise<SubmissaoDetalhada> {
    await this.buscarAlunoAtivo(profissionalId, alunoId);
    let submissao = await this.buscarRascunho(alunoId, id);

    const respondidoEm = definirDataResposta(submissao, dados?.respondidoEm);
    const perguntas = await this.perguntasDaVersao(submissao);

    // Últimas alterações enviadas junto com o "enviar" (ficam salvas no rascunho
    // mesmo se faltar alguma obrigatória, como num autosave).
    if (dados?.respostas) {
      submissao = await this.gravar(submissao.id, validarRespostas(perguntas, dados.respostas));
    }

    const pendentes = obrigatoriasPendentes(perguntas, submissao);
    if (pendentes.length > 0) {
      throw Erros.obrigatoriasPendentes(pendentes);
    }

    const finalizada = await tratarFinalizada(async () =>
      this.repository.finalizar(submissao.id, respondidoEm),
    );
    return this.detalhar(finalizada, await this.modeloDa(profissionalId, finalizada), perguntas);
  }

  /** BE-RSP-04 · Histórico do aluno: só submissões finais. Aluno inativo continua consultável. */
  async listar(
    profissionalId: string,
    alunoId: string,
    query: ListarSubmissoesQuery,
  ): Promise<Paginated<SubmissaoComModelo>> {
    await this.buscarAluno(profissionalId, alunoId);

    const { items, total } = await this.repository.list(alunoId, {
      tipo: query.tipo,
      modeloId: query.modeloId,
      de: query.de ? new Date(query.de) : undefined,
      ate: query.ate ? new Date(query.ate) : undefined,
      sort: query.sort,
      ...toSkipTake(query),
    });

    // Um modelo por id distinto da página (com o Prisma vira JOIN).
    const idsModelos = [...new Set(items.map((submissao) => submissao.modeloId))];
    const modelos = new Map(
      await Promise.all(
        idsModelos.map(
          async (modeloId) => [modeloId, await this.modelo(profissionalId, modeloId)] as const,
        ),
      ),
    );
    const data = items.map((submissao) => ({
      submissao,
      modelo: modelos.get(submissao.modeloId) ?? semModelo(submissao.modeloId),
    }));

    return paginate(data, total, query);
  }

  /** BE-RSP-04 · Detalhe com as perguntas da versão respondida (rascunho ou final). */
  async buscar(profissionalId: string, alunoId: string, id: string): Promise<SubmissaoDetalhada> {
    await this.buscarAluno(profissionalId, alunoId);

    const submissao = await this.repository.findById(alunoId, id);
    if (!submissao) {
      throw Erros.submissaoNaoEncontrada();
    }
    return this.detalhar(submissao, await this.modeloDa(profissionalId, submissao));
  }

  // ─── Apoio ────────────────────────────────────────────────────────────────

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async buscarAlunoAtivo(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo();
    }
    return aluno;
  }

  /** Submissão que ainda pode ser alterada. */
  private async buscarRascunho(alunoId: string, id: string): Promise<Submissao> {
    const submissao = await this.repository.findById(alunoId, id);
    if (!submissao) {
      throw Erros.submissaoNaoEncontrada();
    }
    if (submissao.status !== 'rascunho') {
      throw Erros.submissaoFinalizada();
    }
    return submissao;
  }

  private async gravar(id: string, alteracoes: AlteracaoResposta[]): Promise<Submissao> {
    return tratarFinalizada(async () => this.repository.salvarRespostas(id, alteracoes));
  }

  /** Perguntas exatamente como estavam na versão respondida (BE-QST-04). */
  private async perguntasDaVersao(submissao: Submissao): Promise<Pergunta[]> {
    const versao = await this.questionarios.findVersao(submissao.modeloId, submissao.versao);
    if (!versao) {
      // Não deveria acontecer: versões nunca são apagadas. Vira 500 e vai para o log.
      throw new Error(
        `Versão ${submissao.versao} do modelo ${submissao.modeloId} não encontrada ` +
          `(submissão ${submissao.id}).`,
      );
    }
    return versao.perguntas;
  }

  private async modeloDa(
    profissionalId: string,
    submissao: Submissao,
  ): Promise<SubmissaoDetalhada['modelo']> {
    return this.modelo(profissionalId, submissao.modeloId);
  }

  private async modelo(
    profissionalId: string,
    modeloId: string,
  ): Promise<SubmissaoDetalhada['modelo']> {
    const modelo = await this.questionarios.findById(profissionalId, modeloId);
    return modelo ? { id: modelo.id, nome: modelo.nome, tipo: modelo.tipo } : semModelo(modeloId);
  }

  private async detalhar(
    submissao: Submissao,
    modelo: SubmissaoDetalhada['modelo'],
    perguntas?: Pergunta[],
  ): Promise<SubmissaoDetalhada> {
    return {
      submissao,
      modelo: { id: modelo.id, nome: modelo.nome, tipo: modelo.tipo },
      perguntas: perguntas ?? (await this.perguntasDaVersao(submissao)),
    };
  }
}

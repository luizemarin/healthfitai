import type { TIPOS_MODELO, TIPOS_PERGUNTA } from './questionarios.schemas';
import type { SortOrder } from '../../shared/http/pagination';
import type { Sexo } from '../alunos/alunos.repository';

/**
 * Contrato de acesso a dados do motor de questionários. O service só conhece
 * esta interface; hoje a implementação é em memória e, com as tabelas
 * modelos_questionario / versões / perguntas, entra a implementação com Prisma
 * sem mexer no service.
 *
 * Visibilidade: o profissional enxerga os modelos dele + os modelos padrão do
 * sistema (profissionalId null). Alterar, só os dele.
 *
 * BE-QST-04 · Versionamento: as perguntas pertencem a uma VERSÃO do modelo, e
 * uma versão nunca é alterada. Editar as perguntas cria a versão seguinte; as
 * respostas (BE-RSP) guardam o id da versão respondida, então o histórico fica
 * intacto mesmo depois de o modelo mudar.
 */

export type TipoModelo = (typeof TIPOS_MODELO)[number];
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export interface Pergunta {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  /** Posição no formulário (1, 2, 3...). */
  ordem: number;
  tipo: TipoPergunta;
  enunciado: string;
  obrigatoria: boolean;
  /** BE-QST-03 · Só true em numero/escala. */
  exibirEvolucao: boolean;
  /** Só em escolha_unica/multipla_escolha. */
  opcoes: string[] | null;
  /** Só em numero/escala. */
  unidade: string | null;
  min: number | null;
  max: number | null;
}

export type NovaPergunta = Omit<Pergunta, 'id'>;

/** Foto imutável das perguntas de um modelo num momento (BE-QST-04). */
export interface VersaoModelo {
  id: string;
  modeloId: string;
  /** 1, 2, 3... dentro do modelo. */
  numero: number;
  perguntas: Pergunta[];
  criadoEm: Date;
}

export type ResumoVersao = Pick<VersaoModelo, 'numero' | 'criadoEm'> & { totalPerguntas: number };

export interface ModeloQuestionario {
  id: string;
  /** null = modelo padrão do sistema (só leitura). */
  profissionalId: string | null;
  tipo: TipoModelo;
  nome: string;
  /** null = serve para qualquer aluno. */
  sexoAlvo: Sexo | null;
  /** Número da versão atual. */
  versao: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  /** Perguntas da versão atual, em ordem. */
  perguntas: Pergunta[];
}

export interface NovoModelo {
  profissionalId: string;
  tipo: TipoModelo;
  nome: string;
  sexoAlvo: Sexo | null;
  perguntas: NovaPergunta[];
}

export interface EdicaoModelo {
  nome: string;
  sexoAlvo: Sexo | null;
  /** Versão que o profissional abriu. Se a atual for outra, nada é salvo. */
  versaoEsperada: number;
  /** Só quando as perguntas mudaram: cria a versão seguinte. null = mantém a atual. */
  novasPerguntas: NovaPergunta[] | null;
}

export type ModeloSortField = 'nome' | 'criadoEm' | 'atualizadoEm';

export interface FiltrosListagemModelos {
  q?: string | undefined;
  tipo?: TipoModelo | undefined;
  ativo?: boolean | undefined;
  sort: SortOrder<ModeloSortField>;
  skip: number;
  take: number;
}

export interface PaginaModelos {
  items: ModeloQuestionario[];
  total: number;
}

/**
 * Lançado quando a versão atual do modelo não é a esperada (outra edição
 * salvou antes). Com o Prisma: UPDATE ... WHERE versao = esperada, que não
 * atualiza nenhuma linha nesse caso.
 */
export class VersaoDesatualizadaError extends Error {
  public readonly versaoAtual: number;

  constructor(versaoAtual: number) {
    super(`O modelo já está na versão ${versaoAtual}.`);
    this.name = 'VersaoDesatualizadaError';
    this.versaoAtual = versaoAtual;
  }
}

export interface QuestionariosRepository {
  /** Cria o modelo já com a versão 1 (no banco, numa transação). */
  create: (dados: NovoModelo) => Promise<ModeloQuestionario>;
  /** Modelo do profissional ou padrão do sistema; null se não existir para ele. */
  findById: (profissionalId: string, id: string) => Promise<ModeloQuestionario | null>;
  list: (profissionalId: string, filtros: FiltrosListagemModelos) => Promise<PaginaModelos>;
  /**
   * Edita um modelo do profissional (nunca um padrão). Retorna null se não existir.
   * @throws VersaoDesatualizadaError
   */
  update: (
    profissionalId: string,
    id: string,
    edicao: EdicaoModelo,
  ) => Promise<ModeloQuestionario | null>;
  /** Ativa ou desativa (nunca apaga). Retorna null se o modelo não for do profissional. */
  definirAtivo: (
    profissionalId: string,
    id: string,
    ativo: boolean,
  ) => Promise<ModeloQuestionario | null>;
  /** Versões do modelo, da mais recente para a mais antiga. */
  listVersoes: (modeloId: string) => Promise<ResumoVersao[]>;
  findVersao: (modeloId: string, numero: number) => Promise<VersaoModelo | null>;
}

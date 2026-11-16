import type {
  EvolucaoRepository,
  LeituraMedida,
  LeituraPergunta,
  LeituraPeso,
  Periodo,
} from './evolucao.repository';
import type { MedidasRepository } from '../medidas/medidas.repository';
import type {
  ModeloQuestionario,
  QuestionariosRepository,
  VersaoModelo,
} from '../questionarios/questionarios.repository';
import type { RespostasRepository, Submissao } from '../respostas/respostas.repository';

/** Lê tudo de uma vez (os históricos são paginados; aqui não faz sentido paginar). */
const TUDO = { skip: 0, take: Number.MAX_SAFE_INTEGER } as const;

/** Dia (AAAA-MM-DD) de um instante no horário de Brasília. */
function diaEmBrasilia(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(momento);
}

function chaveVersao(modeloId: string, numero: number): string {
  return `${modeloId}:${numero}`;
}

/** Modelos e versões nunca são apagados: se sumirem, é bug. Vira 500 e vai para o log. */
function obrigatorio<T>(valor: T | undefined, oQue: string): T {
  if (valor === undefined) {
    throw new Error(`${oQue} de uma submissão não foi encontrado(a).`);
  }
  return valor;
}

function dentroDoPeriodo(data: string, { de, ate }: Periodo): boolean {
  // Datas AAAA-MM-DD comparam corretamente como texto.
  return (de === undefined || data >= de) && (ate === undefined || data <= ate);
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma. Não guarda nada: lê dos
 * repositórios dos outros módulos (peso/medidas, respostas e questionários).
 */
export class InMemoryEvolucaoRepository implements EvolucaoRepository {
  private readonly medidas: MedidasRepository;

  private readonly respostas: RespostasRepository;

  private readonly questionarios: QuestionariosRepository;

  constructor(
    medidas: MedidasRepository,
    respostas: RespostasRepository,
    questionarios: QuestionariosRepository,
  ) {
    this.medidas = medidas;
    this.respostas = respostas;
    this.questionarios = questionarios;
  }

  async listarPesos(alunoId: string, periodo: Periodo): Promise<LeituraPeso[]> {
    const { items } = await this.medidas.listarRegistrosPeso(alunoId, {
      ...periodo,
      direcao: 'asc',
      ...TUDO,
    });
    return items.map((registro) => ({
      data: registro.dataRegistro,
      momento: registro.criadoEm,
      valor: registro.pesoKg,
    }));
  }

  async listarMedidas(
    profissionalId: string,
    alunoId: string,
    periodo: Periodo,
  ): Promise<LeituraMedida[]> {
    const [tipos, { items }] = await Promise.all([
      this.medidas.listarTipos(profissionalId),
      this.medidas.listarRegistrosMedida(alunoId, { ...periodo, direcao: 'asc', ...TUDO }),
    ]);
    const tipoPorId = new Map(tipos.map((tipo) => [tipo.id, tipo]));

    return items.flatMap((registro) => {
      const tipo = tipoPorId.get(registro.tipoId);
      if (!tipo) {
        return [];
      }
      return [
        {
          data: registro.dataRegistro,
          momento: registro.criadoEm,
          valor: registro.valor,
          tipo: { id: tipo.id, nome: tipo.nome, unidade: tipo.unidade, ativo: tipo.ativo },
        },
      ];
    });
  }

  async listarRespostasEvolucao(
    profissionalId: string,
    alunoId: string,
    periodo: Periodo,
  ): Promise<LeituraPergunta[]> {
    // Filtra o período pelo dia em Brasília (e não pelo instante UTC).
    const { items } = await this.respostas.list(alunoId, {
      sort: { field: 'respondidoEm', direction: 'asc' },
      ...TUDO,
    });
    const submissoes = items.flatMap((submissao) => {
      if (submissao.respondidoEm === null) {
        return [];
      }
      const data = diaEmBrasilia(submissao.respondidoEm);
      return dentroDoPeriodo(data, periodo)
        ? [{ submissao, data, respondidoEm: submissao.respondidoEm }]
        : [];
    });

    // Um modelo e uma versão por id distinto (com o Prisma vira JOIN).
    const [modelos, versoes] = await Promise.all([
      this.carregarModelos(
        profissionalId,
        submissoes.map(({ submissao }) => submissao.modeloId),
      ),
      this.carregarVersoes(submissoes.map(({ submissao }) => submissao)),
    ]);

    return submissoes.flatMap(({ submissao, data, respondidoEm }) => {
      const modelo = obrigatorio(modelos.get(submissao.modeloId), `Modelo ${submissao.modeloId}`);
      const versao = obrigatorio(
        versoes.get(chaveVersao(submissao.modeloId, submissao.versao)),
        `Versão ${submissao.versao} do modelo ${submissao.modeloId}`,
      );
      const perguntaPorId = new Map(versao.perguntas.map((pergunta) => [pergunta.id, pergunta]));

      return submissao.respostas.flatMap(({ perguntaId, valor }): LeituraPergunta[] => {
        const pergunta = perguntaPorId.get(perguntaId);
        if (!pergunta?.exibirEvolucao || typeof valor !== 'number') {
          return [];
        }
        return [
          {
            data,
            momento: respondidoEm,
            valor,
            submissaoId: submissao.id,
            modelo: { id: modelo.id, nome: modelo.nome, tipo: modelo.tipo },
            pergunta: {
              id: pergunta.id,
              tipo: pergunta.tipo,
              enunciado: pergunta.enunciado,
              unidade: pergunta.unidade,
              min: pergunta.min,
              max: pergunta.max,
            },
          },
        ];
      });
    });
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private async carregarModelos(
    profissionalId: string,
    ids: string[],
  ): Promise<Map<string, ModeloQuestionario>> {
    const encontrados = await Promise.all(
      [...new Set(ids)].map(async (id) => this.questionarios.findById(profissionalId, id)),
    );
    return new Map(encontrados.flatMap((modelo) => (modelo ? [[modelo.id, modelo] as const] : [])));
  }

  private async carregarVersoes(
    submissoes: Pick<Submissao, 'modeloId' | 'versao'>[],
  ): Promise<Map<string, VersaoModelo>> {
    const distintas = new Map(
      submissoes.map((item) => [chaveVersao(item.modeloId, item.versao), item] as const),
    );
    const encontradas = await Promise.all(
      [...distintas.values()].map(async (item) =>
        this.questionarios.findVersao(item.modeloId, item.versao),
      ),
    );
    return new Map(
      encontradas.flatMap((versao) =>
        versao ? [[chaveVersao(versao.modeloId, versao.numero), versao] as const] : [],
      ),
    );
  }
}

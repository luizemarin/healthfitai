import { AppError } from '../../shared/errors/app-error';

import type {
  EvolucaoRepository,
  LeituraBase,
  LeituraMedida,
  LeituraPergunta,
} from './evolucao.repository';
import type { EvolucaoQuery } from './evolucao.schemas';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
};

export interface Ponto {
  data: string;
  valor: number;
}

export interface PontoPergunta extends Ponto {
  submissaoId: string;
}

export interface SerieMedida {
  tipo: LeituraMedida['tipo'];
  pontos: Ponto[];
}

export interface SeriePergunta {
  modelo: LeituraPergunta['modelo'];
  /** Como está na versão mais recente respondida. */
  pergunta: LeituraPergunta['pergunta'];
  pontos: PontoPergunta[];
}

export interface Evolucao {
  periodo: { de: string | null; ate: string | null };
  pesos: Ponto[];
  medidas: SerieMedida[];
  perguntas: SeriePergunta[];
}

/**
 * Um ponto por dia: se houver mais de um valor no mesmo dia, vale o mais
 * recente (igual ao histórico de peso). Devolve em ordem de data crescente,
 * que é a ordem que o gráfico desenha.
 */
function umPorDia<T extends LeituraBase>(leituras: T[]): T[] {
  const ordenadas = [...leituras].sort(
    (a, b) => a.data.localeCompare(b.data) || a.momento.getTime() - b.momento.getTime(),
  );
  const porDia = new Map<string, T>();
  ordenadas.forEach((leitura) => porDia.set(leitura.data, leitura));
  return [...porDia.values()];
}

type Grupo<T> = [T, ...T[]];

/** Agrupa pela chave, mantendo a ordem em que cada grupo aparece. Nenhum grupo vem vazio. */
function agrupar<T>(itens: T[], chave: (item: T) => string): Grupo<T>[] {
  const grupos = new Map<string, Grupo<T>>();
  itens.forEach((item) => {
    const grupo = grupos.get(chave(item));
    if (grupo) {
      grupo.push(item);
    } else {
      grupos.set(chave(item), [item]);
    }
  });
  return [...grupos.values()];
}

/** Leitura de momento mais recente do grupo. */
function maisRecente<T extends LeituraBase>(grupo: Grupo<T>): T {
  return grupo.reduce((atual, leitura) => (leitura.momento > atual.momento ? leitura : atual));
}

/** "Nível de dor (0-10) " = "nivel de dor (0-10)": ignora maiúsculas, acentos e espaços. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Mesma curva = mesma pergunta do mesmo modelo, mesmo que o modelo tenha
 * ganhado versões novas (BE-QST-04: cada versão tem perguntas com ids novos).
 * Reconhece pelo enunciado. Tipo ou unidade diferentes viram outra curva:
 * uma curva nunca mistura unidades.
 */
function chavePergunta({ modelo, pergunta }: LeituraPergunta): string {
  return [modelo.id, normalizar(pergunta.enunciado), pergunta.tipo, pergunta.unidade ?? ''].join(
    '|',
  );
}

const porNome = (a: string, b: string): number => a.localeCompare(b, 'pt-BR');

function seriesDeMedidas(leituras: LeituraMedida[]): SerieMedida[] {
  return agrupar(leituras, (leitura) => leitura.tipo.id)
    .map((grupo) => ({
      tipo: maisRecente(grupo).tipo,
      pontos: umPorDia(grupo).map(({ data, valor }) => ({ data, valor })),
    }))
    .sort((a, b) => porNome(a.tipo.nome, b.tipo.nome));
}

function seriesDePerguntas(leituras: LeituraPergunta[]): SeriePergunta[] {
  return agrupar(leituras, chavePergunta)
    .map((grupo) => {
      // Nome e limites como estão na versão mais recente respondida.
      const { modelo, pergunta } = maisRecente(grupo);
      return {
        modelo,
        pergunta,
        pontos: umPorDia(grupo).map(({ data, valor, submissaoId }) => ({
          data,
          valor,
          submissaoId,
        })),
      };
    })
    .sort(
      (a, b) =>
        porNome(a.modelo.nome, b.modelo.nome) ||
        porNome(a.pergunta.enunciado, b.pergunta.enunciado),
    );
}

/**
 * BE-EVO-01 · Séries de evolução do aluno: peso, medidas e perguntas marcadas
 * com "exibir no gráfico de evolução" (BE-QST-03). Só leitura; aluno inativo
 * continua consultável. Não conhece HTTP/Express.
 */
export class EvolucaoService {
  private readonly repository: EvolucaoRepository;

  private readonly alunos: AlunosRepository;

  constructor(repository: EvolucaoRepository, alunos: AlunosRepository) {
    this.repository = repository;
    this.alunos = alunos;
  }

  async buscar(profissionalId: string, alunoId: string, query: EvolucaoQuery): Promise<Evolucao> {
    await this.buscarAluno(profissionalId, alunoId);

    const periodo = { de: query.de, ate: query.ate };
    const [pesos, medidas, perguntas] = await Promise.all([
      this.repository.listarPesos(alunoId, periodo),
      this.repository.listarMedidas(profissionalId, alunoId, periodo),
      this.repository.listarRespostasEvolucao(profissionalId, alunoId, periodo),
    ]);

    return {
      periodo: { de: query.de ?? null, ate: query.ate ?? null },
      pesos: umPorDia(pesos).map(({ data, valor }) => ({ data, valor })),
      medidas: seriesDeMedidas(medidas),
      perguntas: seriesDePerguntas(perguntas),
    };
  }

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }
}

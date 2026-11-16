import {
  diaEmBrasilia,
  DIAS_PERIODO_MAXIMO,
  DIAS_PERIODO_PADRAO,
  diasEntre,
  hojeEmBrasilia,
  inicioDaSemana,
  somarDias,
} from './dashboard.periodo';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type { DashboardRepository, LeituraExecucao } from './dashboard.repository';
import type { ListarDashboardQuery, PeriodoQuery } from './dashboard.schemas';
import type { Paginated, SortOrder } from '../../shared/http/pagination';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';
import type { Exercicio, ExerciciosRepository } from '../exercicios/exercicios.repository';

/** Lê todos os alunos de uma vez: as métricas são calculadas antes de paginar. */
const TUDO = { skip: 0, take: Number.MAX_SAFE_INTEGER } as const;

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  periodoMuitoLongo: (dias: number) =>
    AppError.validation(
      [
        {
          field: 'query.de',
          message: `O período tem ${dias} dias; o máximo é ${DIAS_PERIODO_MAXIMO}.`,
        },
      ],
      `Período muito longo. Escolha um intervalo de até ${DIAS_PERIODO_MAXIMO} dias.`,
    ),
};

// ─── Tipos do resultado ─────────────────────────────────────────────────────

export interface PeriodoDashboard {
  de: string;
  ate: string;
  dias: number;
}

export interface Frequencia {
  treinos: number;
  diasTreinados: number;
  mediaSemanal: number;
  ultimoTreinoEm: Date | null;
  diasSemTreinar: number | null;
}

export interface Semana {
  inicio: string;
  fim: string;
  treinos: number;
}

export interface ProgressaoCarga {
  exercicioId: string;
  pontos: { data: string; cargaMaximaKg: number }[];
  cargaInicialKg: number;
  cargaAtualKg: number;
  variacaoKg: number;
  variacaoPercentual: number | null;
}

export interface ItemDashboard {
  aluno: Aluno;
  frequencia: Frequencia;
}

export interface PaginaDashboard extends Paginated<ItemDashboard> {
  periodo: PeriodoDashboard;
}

export interface DashboardAluno {
  periodo: PeriodoDashboard;
  aluno: Aluno;
  frequencia: Frequencia;
  semanas: Semana[];
  progressaoCarga: ProgressaoCarga[];
  /** Exercícios da biblioteca usados na progressão (inclusive excluídos). */
  exercicios: Map<string, Exercicio>;
}

type OrdenacaoDashboard = SortOrder<ListarDashboardQuery['sort']['field']>;

// ─── Cálculos (funções puras) ───────────────────────────────────────────────

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/**
 * Completa o período com os padrões (últimos 30 dias até hoje) e confere o
 * tamanho máximo. A ordem de/ate e "não pode ser no futuro" já vêm do schema.
 */
function resolverPeriodo(query: PeriodoQuery, hoje: string): PeriodoDashboard {
  const ate = query.ate ?? hoje;
  const de = query.de ?? somarDias(ate, -(DIAS_PERIODO_PADRAO - 1));
  const dias = diasEntre(de, ate) + 1;

  if (dias > DIAS_PERIODO_MAXIMO) {
    throw Erros.periodoMuitoLongo(dias);
  }
  return { de, ate, dias };
}

/** Frequência de UM aluno: recebe só as execuções dele no período. */
function calcularFrequencia(
  execucoes: LeituraExecucao[],
  ultimoTreinoEm: Date | undefined,
  periodo: PeriodoDashboard,
  hoje: string,
): Frequencia {
  return {
    treinos: execucoes.length,
    diasTreinados: new Set(execucoes.map(({ data }) => data)).size,
    mediaSemanal: arredondar((execucoes.length * 7) / periodo.dias, 1),
    ultimoTreinoEm: ultimoTreinoEm ?? null,
    diasSemTreinar: ultimoTreinoEm ? diasEntre(diaEmBrasilia(ultimoTreinoEm), hoje) : null,
  };
}

/** Todas as semanas do período (segunda a domingo), inclusive as sem treino. */
function calcularSemanas(execucoes: LeituraExecucao[], periodo: PeriodoDashboard): Semana[] {
  const porSemana = new Map<string, number>();
  execucoes.forEach(({ data }) => {
    const semana = inicioDaSemana(data);
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
  });

  const semanas: Semana[] = [];
  for (
    let segunda = inicioDaSemana(periodo.de);
    segunda <= periodo.ate;
    segunda = somarDias(segunda, 7)
  ) {
    const domingo = somarDias(segunda, 6);
    semanas.push({
      // A primeira e a última semana podem ser parciais: cortadas no período.
      inicio: segunda < periodo.de ? periodo.de : segunda,
      fim: domingo > periodo.ate ? periodo.ate : domingo,
      treinos: porSemana.get(segunda) ?? 0,
    });
  }
  return semanas;
}

/**
 * Progressão de carga por exercício: a maior carga de cada dia. Séries sem
 * carga (peso do corpo) não entram; exercício sem nenhuma carga fica de fora.
 */
function calcularProgressao(execucoes: LeituraExecucao[]): ProgressaoCarga[] {
  // exercicioId → (dia → maior carga do dia)
  const cargas = new Map<string, Map<string, number>>();
  execucoes.forEach(({ data, series }) => {
    series.forEach(({ exercicioId, cargaKg }) => {
      if (cargaKg === null) {
        return;
      }
      const porDia = cargas.get(exercicioId) ?? new Map<string, number>();
      porDia.set(data, Math.max(porDia.get(data) ?? cargaKg, cargaKg));
      cargas.set(exercicioId, porDia);
    });
  });

  return [...cargas.entries()].flatMap(([exercicioId, porDia]) => {
    const pontos = [...porDia.entries()]
      .map(([data, cargaMaximaKg]) => ({ data, cargaMaximaKg }))
      .sort((a, b) => a.data.localeCompare(b.data));
    const primeiro = pontos[0];
    const ultimo = pontos.at(-1);
    if (!primeiro || !ultimo) {
      return [];
    }
    const variacaoKg = arredondar(ultimo.cargaMaximaKg - primeiro.cargaMaximaKg, 2);
    return [
      {
        exercicioId,
        pontos,
        cargaInicialKg: primeiro.cargaMaximaKg,
        cargaAtualKg: ultimo.cargaMaximaKg,
        variacaoKg,
        variacaoPercentual:
          primeiro.cargaMaximaKg > 0
            ? arredondar((variacaoKg / primeiro.cargaMaximaKg) * 100, 1)
            : null,
      },
    ];
  });
}

function agruparPorAluno(execucoes: LeituraExecucao[]): Map<string, LeituraExecucao[]> {
  const grupos = new Map<string, LeituraExecucao[]>();
  execucoes.forEach((execucao) => {
    const grupo = grupos.get(execucao.alunoId) ?? [];
    grupo.push(execucao);
    grupos.set(execucao.alunoId, grupo);
  });
  return grupos;
}

const porNome = (a: string, b: string): number => a.localeCompare(b, 'pt-BR');

/** Ordena a visão consolidada. Empate: pelo nome do aluno (ordem estável entre páginas). */
function comparar({ field, direction }: OrdenacaoDashboard) {
  const sinal = direction === 'asc' ? 1 : -1;
  return (a: ItemDashboard, b: ItemDashboard): number => {
    let comparacao = 0;
    if (field === 'treinos') {
      comparacao = a.frequencia.treinos - b.frequencia.treinos;
    } else if (field === 'ultimoTreinoEm') {
      // Quem nunca treinou conta como o treino mais antigo.
      comparacao =
        (a.frequencia.ultimoTreinoEm?.getTime() ?? 0) -
        (b.frequencia.ultimoTreinoEm?.getTime() ?? 0);
    }
    return (
      sinal * comparacao ||
      porNome(a.aluno.nome, b.aluno.nome) ||
      a.aluno.id.localeCompare(b.aluno.id)
    );
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * BE-DSH-01 · Painel do profissional: frequência de treino e progressão de
 * carga, a partir dos treinos finalizados (BE-TRE-02). Só leitura; aluno
 * inativo continua consultável. Não conhece HTTP/Express.
 */
export class DashboardService {
  private readonly repository: DashboardRepository;

  private readonly alunos: AlunosRepository;

  private readonly exercicios: ExerciciosRepository;

  constructor(
    repository: DashboardRepository,
    alunos: AlunosRepository,
    exercicios: ExerciciosRepository,
  ) {
    this.repository = repository;
    this.alunos = alunos;
    this.exercicios = exercicios;
  }

  /**
   * Visão consolidada: frequência de cada aluno do profissional.
   * PROVISÓRIO: calcula para todos e pagina depois (o profissional tem poucos
   * alunos). Com o Prisma, contagem, ordenação e paginação vão para o SQL.
   */
  async listar(profissionalId: string, query: ListarDashboardQuery): Promise<PaginaDashboard> {
    const hoje = hojeEmBrasilia();
    const periodo = resolverPeriodo(query, hoje);

    const { items: alunos } = await this.alunos.list(profissionalId, {
      q: query.q,
      ativo: query.ativo,
      sort: { field: 'nome', direction: 'asc' },
      ...TUDO,
    });
    const ids = alunos.map(({ id }) => id);

    const [execucoes, ultimos] = await Promise.all([
      this.repository.listarExecucoes(ids, periodo),
      this.repository.buscarUltimosTreinos(ids),
    ]);
    const porAluno = agruparPorAluno(execucoes);

    const itens = alunos
      .map((aluno) => ({
        aluno,
        frequencia: calcularFrequencia(
          porAluno.get(aluno.id) ?? [],
          ultimos.get(aluno.id),
          periodo,
          hoje,
        ),
      }))
      .sort(comparar(query.sort));

    const { skip, take } = toSkipTake(query);
    return { periodo, ...paginate(itens.slice(skip, skip + take), itens.length, query) };
  }

  /** Detalhe de um aluno: frequência semana a semana e progressão de carga por exercício. */
  async buscarDoAluno(
    profissionalId: string,
    alunoId: string,
    query: PeriodoQuery,
  ): Promise<DashboardAluno> {
    const hoje = hojeEmBrasilia();
    const periodo = resolverPeriodo(query, hoje);
    const aluno = await this.buscarAluno(profissionalId, alunoId);

    const [execucoes, ultimos] = await Promise.all([
      this.repository.listarExecucoes([alunoId], periodo),
      this.repository.buscarUltimosTreinos([alunoId]),
    ]);

    const progressao = calcularProgressao(execucoes);
    const encontrados = await this.exercicios.findByIds(
      profissionalId,
      progressao.map(({ exercicioId }) => exercicioId),
    );
    const exercicios = new Map(encontrados.map((exercicio) => [exercicio.id, exercicio]));
    const nomeDe = (id: string): string => exercicios.get(id)?.nome ?? '';

    return {
      periodo,
      aluno,
      frequencia: calcularFrequencia(execucoes, ultimos.get(alunoId), periodo, hoje),
      semanas: calcularSemanas(execucoes, periodo),
      progressaoCarga: progressao.sort((a, b) =>
        porNome(nomeDe(a.exercicioId), nomeDe(b.exercicioId)),
      ),
      exercicios,
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

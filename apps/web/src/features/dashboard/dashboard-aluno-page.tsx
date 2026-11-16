import { Link, useParams, useSearchParams } from 'react-router';

import { dashboardApi } from './dashboard-api';
import {
  errosDoPeriodo,
  formatarDia,
  formatarKg,
  formatarMedia,
  formatarVariacao,
  lerPeriodo,
  periodoNaUrl,
  textoDiasSemTreinar,
} from './dashboard-formato';
import { Numeros } from './numeros';
import { PeriodoCampos, PeriodoResumo } from './periodo-campos';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarData } from '../alunos/aluno-formato';
import { StatusBadge } from '../alunos/status-badge';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { DashboardSemana, ProgressaoCarga } from './dashboard-api';

/**
 * FE-DSH-01 · Detalhe de um aluno no dashboard (BE-DSH-01):
 * frequência no período, treinos semana a semana e progressão de carga por exercício.
 */
export function DashboardAlunoPage(): ReactElement {
  const { id: alunoId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { de, ate } = lerPeriodo(params);

  const filtrar = (nome: 'de' | 'ate', valor: string): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        if (valor) novo.set(nome, valor);
        else novo.delete(nome);
        return novo;
      },
      { replace: true },
    );
  };

  const dashboard = useAsync(
    async (signal) => dashboardApi.aluno(alunoId, { de, ate }, signal),
    [alunoId, de, ate],
  );

  const errosPeriodo = dashboard.status === 'error' ? errosDoPeriodo(dashboard.error) : {};
  const periodoInvalido = Boolean(errosPeriodo.de ?? errosPeriodo.ate);

  const voltar = (
    <Link to={`/dashboard${periodoNaUrl({ de, ate })}`} className="hf-button hf-button--secondary">
      Voltar ao dashboard
    </Link>
  );

  let conteudo: ReactElement;
  if (dashboard.status === 'loading') {
    conteudo = <LoadingState label="Carregando frequência e progresso…" />;
  } else if (dashboard.status === 'error') {
    conteudo = (
      <ErrorState
        error={dashboard.error}
        title="Não conseguimos carregar o dashboard do aluno"
        message={mensagemDaApi(dashboard.error)}
        onRetry={periodoInvalido ? undefined : dashboard.reload}
        action={
          periodoInvalido ? (
            <button
              type="button"
              className="hf-button hf-button--secondary"
              onClick={() => setParams({}, { replace: true })}
            >
              Usar últimos 30 dias
            </button>
          ) : (
            voltar
          )
        }
      />
    );
  } else {
    const { aluno, periodo, frequencia, progressaoCarga } = dashboard.data;
    conteudo = (
      <div className="grid gap-lg">
        <div className="flex flex-wrap items-center gap-sm">
          <h2 className="m-0">{aluno.nome}</h2>
          <StatusBadge ativo={aluno.ativo} />
          <Link to={`/alunos/${aluno.id}`} className="text-sm">
            Abrir ficha
          </Link>
        </div>

        <section className="rounded-md border border-border bg-surface p-md">
          <h3>Frequência</h3>
          <PeriodoResumo periodo={periodo} />
          <Numeros
            itens={[
              { label: 'Treinos', valor: String(frequencia.treinos) },
              { label: 'Dias treinados', valor: String(frequencia.diasTreinados) },
              { label: 'Média semanal', valor: formatarMedia(frequencia.mediaSemanal) },
              {
                label: 'Último treino',
                valor: frequencia.ultimoTreinoEm ? formatarDia(frequencia.ultimoTreinoEm) : '—',
              },
            ]}
          />
          <p className="mb-0 mt-sm text-sm text-foreground-muted">
            {textoDiasSemTreinar(frequencia.diasSemTreinar)}
          </p>
        </section>

        <section className="rounded-md border border-border bg-surface p-md">
          <h3>Treinos por semana</h3>
          <SemanasBarras semanas={frequencia.semanas} />
        </section>

        <section className="rounded-md border border-border bg-surface p-md">
          <h3>Progressão de carga</h3>
          {progressaoCarga.length === 0 ? (
            <EmptyState
              title="Sem cargas registradas no período"
              description="Os exercícios aparecem aqui quando o aluno registra carga nos treinos."
            />
          ) : (
            <ProgressaoTabela progressao={progressaoCarga} />
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0">Frequência e progresso</h1>
        {voltar}
      </div>

      <div className="mb-lg grid gap-md md:max-w-[480px] md:grid-cols-2">
        <PeriodoCampos valor={{ de, ate }} erros={errosPeriodo} onChange={filtrar} />
      </div>

      {conteudo}
    </>
  );
}

/**
 * Barras de treinos por semana (todas as semanas do período, inclusive com 0).
 * A altura é proporcional à semana com mais treinos; o número fica em cima de cada barra.
 */
function SemanasBarras({ semanas }: { semanas: DashboardSemana[] }): ReactElement {
  const maximo = Math.max(1, ...semanas.map((semana) => semana.treinos));

  return (
    <div className="hf-table-scroll">
      <ol className="m-0 flex h-48 list-none items-end gap-sm p-0" aria-label="Treinos por semana">
        {semanas.map((semana) => (
          <li
            key={semana.inicio}
            className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-xs"
          >
            <span className="font-heading text-sm font-semibold tabular-nums">
              {semana.treinos}
              <span className="sr-only">
                {semana.treinos === 1 ? ' treino' : ' treinos'} de {formatarData(semana.inicio)} a{' '}
                {formatarData(semana.fim)}
              </span>
            </span>
            <span className="flex w-full flex-1 items-end" aria-hidden="true">
              <span
                className="w-full rounded-sm bg-primary"
                style={{ height: `${String((semana.treinos / maximo) * 100)}%` }}
              />
            </span>
            <span className="text-xs text-foreground-muted tabular-nums" aria-hidden="true">
              {formatarData(semana.inicio).slice(0, 5)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Uma linha por exercício: carga inicial, atual e variação no período; cargas por dia ao abrir. */
function ProgressaoTabela({ progressao }: { progressao: ProgressaoCarga[] }): ReactElement {
  return (
    <div className="hf-table-scroll">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Progressão de carga por exercício</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="min-w-[200px] p-sm">
              Exercício
            </th>
            <th scope="col" className="p-sm">
              Inicial
            </th>
            <th scope="col" className="p-sm">
              Atual
            </th>
            <th scope="col" className="min-w-[160px] p-sm">
              Variação
            </th>
          </tr>
        </thead>
        <tbody>
          {progressao.map((item) => (
            <tr key={item.exercicio.id} className="border-b border-border align-top">
              <th scope="row" className="p-sm font-normal">
                <span className="flex flex-wrap items-center gap-sm">
                  <span className="font-semibold">{item.exercicio.nome}</span>
                  {!item.exercicio.ativo && (
                    <span className="hf-badge border-border text-foreground-muted">
                      Excluído da biblioteca
                    </span>
                  )}
                </span>
                <span className="block text-sm text-foreground-muted">
                  {item.exercicio.grupoMuscular}
                </span>
                <details className="mt-xs text-sm">
                  <summary className="cursor-pointer">Cargas por dia</summary>
                  <ul className="m-0 mt-xs list-none p-0 tabular-nums">
                    {item.pontos.map((ponto) => (
                      <li key={ponto.data}>
                        {formatarData(ponto.data)}: {formatarKg(ponto.cargaMaximaKg)}
                      </li>
                    ))}
                  </ul>
                </details>
              </th>
              <td className="p-sm tabular-nums">{formatarKg(item.cargaInicialKg)}</td>
              <td className="p-sm tabular-nums">{formatarKg(item.cargaAtualKg)}</td>
              <td className="p-sm tabular-nums">
                {formatarVariacao(item.variacaoKg, item.variacaoPercentual)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

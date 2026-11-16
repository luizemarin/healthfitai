import { useEffect, useState } from 'react';

import { Link, useSearchParams } from 'react-router';

import { dashboardApi } from './dashboard-api';
import {
  errosDoPeriodo,
  formatarDia,
  formatarMedia,
  lerPeriodo,
  periodoNaUrl,
  textoDiasSemTreinar,
} from './dashboard-formato';
import { Numeros } from './numeros';
import { PeriodoCampos, PeriodoResumo } from './periodo-campos';
import { Field } from '../../components/form/field';
import { AsyncContent, EmptyState, ErrorState, useAsync } from '../../components/states';
import { StatusBadge } from '../alunos/status-badge';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { DashboardAlunoItem, FiltrosDashboard, OrdemDashboard } from './dashboard-api';

const ESPERA_BUSCA_MS = 300;

/** Ordenações aceitas pelo back (sort), com o texto da tela. A primeira é o padrão do back. */
const ORDENS: { valor: OrdemDashboard; label: string }[] = [
  { valor: 'nome', label: 'Nome (A–Z)' },
  { valor: '-nome', label: 'Nome (Z–A)' },
  { valor: '-treinos', label: 'Mais treinos' },
  { valor: 'treinos', label: 'Menos treinos' },
  { valor: '-ultimoTreinoEm', label: 'Último treino mais recente' },
  { valor: 'ultimoTreinoEm', label: 'Último treino mais antigo' },
];

/** Lê os filtros da URL: a visão filtrada pode ser recarregada, voltada e compartilhada. */
function lerFiltros(params: URLSearchParams): FiltrosDashboard {
  const q = params.get('q')?.trim();
  const sort = ORDENS.find((ordem) => ordem.valor === params.get('sort'))?.valor;
  const page = Number(params.get('page'));
  return {
    ...lerPeriodo(params),
    q: q || undefined,
    ativo: params.get('ativo') === 'false' ? 'false' : undefined,
    sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

type Filtro = 'q' | 'ativo' | 'sort' | 'de' | 'ate';

/**
 * FE-DSH-01 · Dashboard de frequência e progresso: visão consolidada dos alunos (BE-DSH-01).
 * Frequência de cada aluno no período; cada card abre o detalhe com a progressão de carga.
 */
export function DashboardPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const { q, ativo, sort, de, ate, page } = filtros;
  const temFiltro = Boolean(q ?? ativo ?? de ?? ate);

  // Busca: o campo responde na hora; a URL (e a chamada à API) só depois de uma pausa na digitação.
  const [busca, setBusca] = useState(q ?? '');

  /** Troca um filtro e volta para a página 1. */
  const filtrar = (nome: Filtro, valor: string): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        if (valor.trim()) novo.set(nome, valor.trim());
        else novo.delete(nome);
        novo.delete('page');
        return novo;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (busca.trim() === (q ?? '')) return undefined;
    const timer = setTimeout(() => filtrar('q', busca), ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à digitação
  }, [busca]);

  const irParaPagina = (nova: number): void => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.set('page', String(nova));
      return novo;
    });
    window.scrollTo({ top: 0 });
  };

  const limparFiltros = (): void => {
    setBusca('');
    setParams({}, { replace: true });
  };

  const limparPeriodo = (): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        ['de', 'ate', 'page'].forEach((nome) => novo.delete(nome));
        return novo;
      },
      { replace: true },
    );
  };

  const lista = useAsync(
    async (signal) => dashboardApi.listar({ q, ativo, sort, de, ate, page }, signal),
    [q, ativo, sort, de, ate, page],
  );

  // Período recusado pelo back (data no futuro, "de" depois de "ate", longo demais):
  // a mensagem dele vai embaixo do campo, e "Tentar novamente" não resolveria.
  const errosPeriodo = lista.status === 'error' ? errosDoPeriodo(lista.error) : {};
  const periodoInvalido = Boolean(errosPeriodo.de ?? errosPeriodo.ate);

  return (
    <>
      <h1 className="mb-lg">Dashboard de frequência e progresso</h1>

      <div className="mb-lg grid gap-md md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <Field id="busca" label="Buscar">
          {(a11y) => (
            <input
              {...a11y}
              type="search"
              className="hf-input"
              placeholder="Nome do aluno"
              maxLength={100}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          )}
        </Field>
        <Field id="filtro-ativo" label="Situação">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={ativo ?? ''}
              onChange={(event) => filtrar('ativo', event.target.value)}
            >
              <option value="">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          )}
        </Field>
        <Field id="ordem" label="Ordenar por">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={sort ?? 'nome'}
              onChange={(event) => filtrar('sort', event.target.value)}
            >
              {ORDENS.map((ordem) => (
                <option key={ordem.valor} value={ordem.valor}>
                  {ordem.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <PeriodoCampos valor={{ de, ate }} erros={errosPeriodo} onChange={filtrar} />
      </div>

      {lista.status === 'error' ? (
        <ErrorState
          error={lista.error}
          title="Não conseguimos carregar o dashboard"
          message={mensagemDaApi(lista.error)}
          onRetry={periodoInvalido ? undefined : lista.reload}
          action={
            periodoInvalido && (
              <button
                type="button"
                className="hf-button hf-button--secondary"
                onClick={limparPeriodo}
              >
                Usar últimos 30 dias
              </button>
            )
          }
        />
      ) : (
        <AsyncContent
          state={lista}
          loadingLabel="Carregando dashboard…"
          isEmpty={(resultado) => resultado.data.length === 0}
          empty={
            temFiltro ? (
              <EmptyState
                title="Nenhum aluno encontrado"
                description="Nenhum aluno corresponde à busca ou aos filtros."
                action={
                  <button
                    type="button"
                    className="hf-button hf-button--secondary"
                    onClick={limparFiltros}
                  >
                    Limpar filtros
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="Nenhum aluno ativo"
                description="Cadastre seus alunos para acompanhar a frequência e o progresso."
                action={
                  <Link to="/alunos/novo" className="hf-button">
                    Cadastrar aluno
                  </Link>
                }
              />
            )
          }
        >
          {({ data, meta, periodo }) => (
            <>
              <PeriodoResumo periodo={periodo} />
              <p className="mb-sm text-sm text-foreground-muted">
                {meta.totalItems === 1 ? '1 aluno' : `${String(meta.totalItems)} alunos`}
              </p>
              <ul className="m-0 grid list-none gap-sm p-0">
                {data.map((item) => (
                  <li key={item.aluno.id}>
                    <AlunoFrequencia item={item} periodo={periodoNaUrl({ de, ate })} />
                  </li>
                ))}
              </ul>
              {meta.totalPages > 1 && (
                <nav
                  aria-label="Paginação"
                  className="mt-lg flex items-center justify-between gap-md"
                >
                  <button
                    type="button"
                    className="hf-button hf-button--secondary"
                    disabled={meta.page <= 1}
                    onClick={() => irParaPagina(meta.page - 1)}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-foreground-muted">
                    Página {meta.page} de {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    className="hf-button hf-button--secondary"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => irParaPagina(meta.page + 1)}
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </>
          )}
        </AsyncContent>
      )}
    </>
  );
}

interface AlunoFrequenciaProps {
  item: DashboardAlunoItem;
  /** Query string do período, para o detalhe abrir no mesmo período. */
  periodo: string;
}

/** Um aluno: nome, situação e os números de frequência. O card inteiro abre o detalhe. */
function AlunoFrequencia({ item, periodo }: AlunoFrequenciaProps): ReactElement {
  const { aluno, frequencia } = item;

  return (
    <Link
      to={`/dashboard/alunos/${aluno.id}${periodo}`}
      className={`flex flex-col gap-sm rounded-md border border-border bg-surface p-md no-underline hover:bg-border ${
        aluno.ativo ? '' : 'opacity-75'
      }`}
    >
      <span className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-heading text-lg font-semibold">{aluno.nome}</span>
        <StatusBadge ativo={aluno.ativo} />
      </span>
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
      <span className="text-sm text-foreground-muted">
        {textoDiasSemTreinar(frequencia.diasSemTreinar)}
      </span>
    </Link>
  );
}

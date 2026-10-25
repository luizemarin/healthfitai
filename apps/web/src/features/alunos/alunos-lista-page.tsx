import { useEffect, useState } from 'react';

import { Link, useSearchParams } from 'react-router';

import { formatarData, formatarTelefone, SEXO_LABEL } from './aluno-formato';
import { alunosApi } from './alunos-api';
import { StatusBadge } from './status-badge';
import { Field } from '../../components/form/field';
import { AsyncContent, EmptyState, useAsync } from '../../components/states';

import type { ReactElement } from 'react';

import type { Aluno, FiltrosAlunos, Sexo } from './alunos-api';

const ESPERA_BUSCA_MS = 300;

/** Lê os filtros da URL: a lista filtrada pode ser recarregada, voltada e compartilhada. */
function lerFiltros(params: URLSearchParams): FiltrosAlunos {
  const ativo = params.get('ativo');
  const sexo = params.get('sexo');
  const page = Number(params.get('page'));
  return {
    q: params.get('q')?.trim() ? params.get('q')?.trim() : undefined,
    ativo: ativo === 'true' || ativo === 'false' ? ativo : undefined,
    sexo: sexo === 'masculino' || sexo === 'feminino' ? (sexo as Sexo) : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** FE-ALU-01 · Lista de alunos: busca, filtros (situação e sexo), paginação e status. */
export function AlunosListaPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const { q, ativo, sexo, page } = filtros;
  const temFiltro = Boolean(q ?? ativo ?? sexo);

  // Busca: o campo responde na hora; a URL (e a chamada à API) só depois de uma pausa na digitação.
  const [busca, setBusca] = useState(q ?? '');

  /** Troca um filtro e volta para a página 1. */
  const filtrar = (nome: 'q' | 'ativo' | 'sexo', valor: string): void => {
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

  const alunos = useAsync(
    async (signal) => alunosApi.listar({ q, ativo, sexo, page }, signal),
    [q, ativo, sexo, page],
  );

  return (
    <>
      <div className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0">Alunos</h1>
        <Link to="/alunos/novo" className="hf-button">
          Cadastrar aluno
        </Link>
      </div>

      <div className="mb-lg grid gap-md md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field id="busca" label="Buscar">
          {(a11y) => (
            <input
              {...a11y}
              type="search"
              className="hf-input"
              placeholder="Nome ou e-mail"
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
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          )}
        </Field>
        <Field id="filtro-sexo" label="Sexo">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={sexo ?? ''}
              onChange={(event) => filtrar('sexo', event.target.value)}
            >
              <option value="">Todos</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          )}
        </Field>
      </div>

      <AsyncContent
        state={alunos}
        loadingLabel="Carregando alunos…"
        isEmpty={(lista) => lista.data.length === 0}
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
              title="Nenhum aluno cadastrado"
              description="Cadastre seu primeiro aluno para começar o acompanhamento."
              action={
                <Link to="/alunos/novo" className="hf-button">
                  Cadastrar aluno
                </Link>
              }
            />
          )
        }
      >
        {({ data, meta }) => (
          <>
            <p className="mb-sm text-sm text-foreground-muted">
              {meta.totalItems === 1 ? '1 aluno' : `${String(meta.totalItems)} alunos`}
            </p>
            <ul className="m-0 grid list-none gap-sm p-0">
              {data.map((aluno) => (
                <li key={aluno.id}>
                  <AlunoLinha aluno={aluno} />
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
    </>
  );
}

/** Uma linha da lista: o card inteiro leva à ficha do aluno. */
function AlunoLinha({ aluno }: { aluno: Aluno }): ReactElement {
  const contato = aluno.email ?? (aluno.telefone ? formatarTelefone(aluno.telefone) : null);

  return (
    <Link
      to={`/alunos/${aluno.id}`}
      className={`flex flex-col gap-xs rounded-md border border-border bg-surface p-md no-underline hover:bg-border ${
        aluno.ativo ? '' : 'opacity-75'
      }`}
    >
      <span className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-heading text-lg font-semibold">{aluno.nome}</span>
        <StatusBadge ativo={aluno.ativo} />
      </span>
      <span className="text-sm text-foreground-muted">
        {SEXO_LABEL[aluno.sexo]} · Nasc. {formatarData(aluno.dataNascimento)}
        {contato && ` · ${contato}`}
      </span>
    </Link>
  );
}

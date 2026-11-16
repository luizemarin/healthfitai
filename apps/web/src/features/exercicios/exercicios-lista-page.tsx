import { useEffect, useState } from 'react';

import { Link, useSearchParams } from 'react-router';

import { exerciciosApi } from './exercicios-api';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { AsyncContent, EmptyState, useAsync } from '../../components/states';
import { avisarErro } from '../questionarios/avisar-erro';

import type { ReactElement } from 'react';

import type { Exercicio, FiltrosExercicios } from './exercicios-api';

const ESPERA_BUSCA_MS = 300;

/** Lê os filtros da URL: a lista filtrada pode ser recarregada, voltada e compartilhada. */
function lerFiltros(params: URLSearchParams): FiltrosExercicios {
  const q = params.get('q')?.trim();
  const page = Number(params.get('page'));
  return { q: q || undefined, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

/** FE-EXE-01 · Biblioteca de exercícios: listar, buscar, criar, editar e excluir. */
export function ExerciciosListaPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const { q, page } = lerFiltros(params);

  // Busca: o campo responde na hora; a URL (e a chamada à API) só depois de uma pausa na digitação.
  const [busca, setBusca] = useState(q ?? '');

  useEffect(() => {
    if (busca.trim() === (q ?? '')) return undefined;
    const timer = setTimeout(() => {
      // Nova busca volta para a página 1.
      setParams(busca.trim() ? { q: busca.trim() } : {}, { replace: true });
    }, ESPERA_BUSCA_MS);
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

  const limparBusca = (): void => {
    setBusca('');
    setParams({}, { replace: true });
  };

  const exercicios = useAsync(
    async (signal) => exerciciosApi.listar({ q, page }, signal),
    [q, page],
  );

  // Exclusão: um exercício por vez, com confirmação.
  const toast = useToast();
  const [excluindo, setExcluindo] = useState<Exercicio | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const excluir = async (exercicio: Exercicio): Promise<void> => {
    setOcupado(true);
    try {
      await exerciciosApi.excluir(exercicio.id);
      toast.success(
        'Exercício excluído.',
        'Os treinos que já usam este exercício continuam iguais.',
      );
      exercicios.reload();
    } catch (error) {
      avisarErro(toast, error, 'Não foi possível excluir o exercício');
    } finally {
      setOcupado(false);
      setExcluindo(null);
    }
  };

  return (
    <>
      <div className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0">Biblioteca de exercícios</h1>
        <Link to="/exercicios/novo" className="hf-button">
          Cadastrar exercício
        </Link>
      </div>

      <div className="mb-lg max-w-[480px]">
        <Field id="busca" label="Buscar">
          {(a11y) => (
            <input
              {...a11y}
              type="search"
              className="hf-input"
              placeholder="Nome ou grupo muscular"
              maxLength={100}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          )}
        </Field>
      </div>

      <AsyncContent
        state={exercicios}
        loadingLabel="Carregando exercícios…"
        isEmpty={(lista) => lista.data.length === 0}
        empty={
          q ? (
            <EmptyState
              title="Nenhum exercício encontrado"
              description="Nenhum exercício corresponde à busca."
              action={
                <button
                  type="button"
                  className="hf-button hf-button--secondary"
                  onClick={limparBusca}
                >
                  Limpar busca
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Nenhum exercício cadastrado"
              description="Cadastre os exercícios que você usa nos treinos dos seus alunos."
              action={
                <Link to="/exercicios/novo" className="hf-button">
                  Cadastrar exercício
                </Link>
              }
            />
          )
        }
      >
        {({ data, meta }) => (
          <>
            <p className="mb-sm text-sm text-foreground-muted">
              {meta.totalItems === 1 ? '1 exercício' : `${String(meta.totalItems)} exercícios`}
            </p>
            <ul className="m-0 grid list-none gap-sm p-0">
              {data.map((exercicio) => (
                <li key={exercicio.id}>
                  <ExercicioLinha
                    exercicio={exercicio}
                    ocupado={ocupado}
                    onExcluir={() => setExcluindo(exercicio)}
                  />
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

      <ConfirmDialog
        open={excluindo !== null}
        title={`Excluir "${excluindo?.nome ?? ''}"?`}
        message="O exercício sai da biblioteca. Os treinos e execuções que já usam ele continuam iguais."
        confirmLabel="Excluir"
        danger
        busy={ocupado}
        onConfirm={() => {
          if (excluindo) void excluir(excluindo);
        }}
        onCancel={() => setExcluindo(null)}
      />
    </>
  );
}

interface ExercicioLinhaProps {
  exercicio: Exercicio;
  /** Alguma exclusão em andamento: botão desabilitado. */
  ocupado: boolean;
  onExcluir: () => void;
}

/** Um exercício da lista: nome, grupo muscular, descrição, link de demonstração e ações. */
function ExercicioLinha({ exercicio, ocupado, onExcluir }: ExercicioLinhaProps): ReactElement {
  return (
    <div className="flex flex-col gap-md rounded-md border border-border bg-surface p-md md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <Link
            to={`/exercicios/${exercicio.id}`}
            className="font-heading text-lg font-semibold text-foreground"
          >
            {exercicio.nome}
          </Link>
          <span className="hf-badge border-border text-foreground">{exercicio.grupoMuscular}</span>
        </span>
        {exercicio.descricao && (
          <p className="m-0 line-clamp-2 text-sm text-foreground-muted">{exercicio.descricao}</p>
        )}
        {exercicio.midiaUrl && (
          <a
            href={exercicio.midiaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm"
          >
            Ver demonstração
          </a>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 md:flex-row">
        <Link to={`/exercicios/${exercicio.id}`} className="hf-button hf-button--secondary">
          Editar
        </Link>
        <button
          type="button"
          className="hf-button hf-button--danger"
          disabled={ocupado}
          onClick={onExcluir}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

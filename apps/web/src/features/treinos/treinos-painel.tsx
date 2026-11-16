import { useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router';

import { treinosApi } from './treinos-api';
import { useToast } from '../../components/feedback/toast';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { Treino } from './treinos-api';

/** "4 exercícios · Agachamento livre, Leg press, Cadeira extensora…" */
function resumo(treino: Treino): string {
  const total = treino.exercicios.length;
  const quantidade = total === 1 ? '1 exercício' : `${String(total)} exercícios`;
  const nomes = treino.exercicios.map((item) => item.exercicio.nome).join(', ');
  return `${quantidade} · ${nomes}`;
}

/**
 * FE-TRE-01 · Treinos do aluno (aba "Treinos" da ficha): montar, editar e duplicar.
 * Duplicar cria a cópia para o mesmo aluno e já abre ela no editor.
 */
export function TreinosPainel({ alunoId }: { alunoId: string }): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const lista = useAsync(
    async (signal) => treinosApi.listar(alunoId, page, signal),
    [alunoId, page],
  );
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);

  const irParaPagina = (nova: number): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        novo.set('pagina', String(nova));
        return novo;
      },
      { replace: true },
    );
  };

  const duplicar = async (treino: Treino): Promise<void> => {
    setDuplicandoId(treino.id);
    try {
      const copia = await treinosApi.duplicar(treino.id);
      toast.success('Treino duplicado.', `"${copia.nome}" já pode ser editado.`);
      await navigate(`/alunos/${alunoId}/treinos/${copia.id}`);
    } catch (error) {
      // Ex.: treino com exercício excluído da biblioteca ou aluno inativo — o back explica.
      avisarErro(toast, error, 'Não foi possível duplicar');
      setDuplicandoId(null);
    }
  };

  const montar = (
    <Link to={`/alunos/${alunoId}/treinos/novo`} className="hf-button">
      Montar treino
    </Link>
  );

  let conteudo: ReactElement;
  if (lista.status === 'loading') {
    conteudo = <LoadingState label="Carregando treinos…" />;
  } else if (lista.status === 'error') {
    conteudo = (
      <ErrorState
        error={lista.error}
        title="Não conseguimos carregar os treinos"
        message={mensagemDaApi(lista.error)}
        onRetry={lista.reload}
      />
    );
  } else if (lista.data.data.length === 0) {
    conteudo = (
      <EmptyState
        title="Nenhum treino ainda"
        description="Monte o primeiro treino com os exercícios da sua biblioteca."
        action={montar}
      />
    );
  } else {
    const { data, meta } = lista.data;
    conteudo = (
      <>
        <ul className="m-0 grid list-none gap-sm p-0">
          {data.map((treino) => (
            <li
              key={treino.id}
              className="flex flex-col gap-md rounded-md border border-border bg-surface p-md md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-xs">
                <Link
                  to={`/alunos/${alunoId}/treinos/${treino.id}`}
                  className="font-heading text-lg font-semibold text-foreground"
                >
                  {treino.nome}
                </Link>
                <p className="m-0 line-clamp-2 text-sm text-foreground-muted">{resumo(treino)}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 md:flex-row">
                <Link
                  to={`/alunos/${alunoId}/treinos/${treino.id}`}
                  className="hf-button hf-button--secondary"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="hf-button hf-button--secondary"
                  disabled={duplicandoId !== null}
                  onClick={() => void duplicar(treino)}
                >
                  {duplicandoId === treino.id ? 'Duplicando…' : 'Duplicar'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-sm">
            <button
              type="button"
              className="hf-button hf-button--secondary"
              disabled={meta.page <= 1}
              onClick={() => irParaPagina(meta.page - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-foreground-muted">
              {meta.page} de {meta.totalPages}
            </span>
            <button
              type="button"
              className="hf-button hf-button--secondary"
              disabled={meta.page >= meta.totalPages}
              onClick={() => irParaPagina(meta.page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="grid gap-lg">
      {lista.status === 'success' && lista.data.data.length > 0 && (
        <div className="flex justify-end">{montar}</div>
      )}
      {conteudo}
    </div>
  );
}

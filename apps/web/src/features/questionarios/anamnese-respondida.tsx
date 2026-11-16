import { useSearchParams } from 'react-router';

import { formatarValor, mensagemDaApi } from './questionario-formato';
import { anamnesesApi } from './questionarios-api';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarDataHora } from '../alunos/aluno-formato';

import type { ReactElement } from 'react';

import type { Submissao, SubmissaoResumo } from './questionarios-api';

/** Erro de carregamento com a mensagem do back quando houver (ex.: "Aluno não encontrado."). */
function ErroAoCarregar({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  title: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <ErrorState error={error} title={title} message={mensagemDaApi(error)} onRetry={onRetry} />
  );
}

/**
 * FE-QST-03 · Anamneses respondidas pelo aluno (aba "Anamnese" da ficha).
 * Leitura por data (mais recente primeiro) e, em cada uma, a versão do modelo respondida:
 * as perguntas aparecem exatamente como estavam naquela versão (BE-QST-04), mesmo que o
 * modelo tenha sido editado depois. A data aberta fica na URL (?aba=anamnese&resposta=<id>).
 */
export function AnamneseRespondida({ alunoId }: { alunoId: string }): ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const lista = useAsync(
    async (signal) => anamnesesApi.listar(alunoId, page, signal),
    [alunoId, page],
  );

  const trocar = (nome: 'resposta' | 'pagina', valor: string): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        novo.set(nome, valor);
        if (nome === 'pagina') novo.delete('resposta');
        return novo;
      },
      { replace: true },
    );
  };

  if (lista.status === 'loading') {
    return <LoadingState label="Carregando anamneses…" />;
  }
  if (lista.status === 'error') {
    return (
      <ErroAoCarregar
        error={lista.error}
        title="Não conseguimos carregar as anamneses"
        onRetry={lista.reload}
      />
    );
  }

  const { data, meta } = lista.data;
  if (data.length === 0) {
    return (
      <EmptyState
        title="Nenhuma anamnese respondida"
        description="Quando o aluno enviar a anamnese, ela aparece aqui, por data."
      />
    );
  }

  // Sem escolha na URL (ou escolha que não está nesta página): abre a mais recente.
  const selecionada = data.find((item) => item.id === params.get('resposta')) ?? data[0];

  return (
    <div className="grid gap-lg lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="Anamneses por data" className="grid content-start gap-sm">
        <ul className="m-0 grid list-none gap-sm p-0">
          {data.map((item) => (
            <li key={item.id}>
              <ItemDaLista
                item={item}
                selecionado={item.id === selecionada?.id}
                onAbrir={() => trocar('resposta', item.id)}
              />
            </li>
          ))}
        </ul>
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-sm">
            <button
              type="button"
              className="hf-button hf-button--secondary"
              disabled={meta.page <= 1}
              onClick={() => trocar('pagina', String(meta.page - 1))}
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
              onClick={() => trocar('pagina', String(meta.page + 1))}
            >
              Próxima
            </button>
          </div>
        )}
      </nav>

      {selecionada && <Detalhe alunoId={alunoId} submissaoId={selecionada.id} />}
    </div>
  );
}

function ItemDaLista({
  item,
  selecionado,
  onAbrir,
}: {
  item: SubmissaoResumo;
  selecionado: boolean;
  onAbrir: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-current={selecionado ? 'true' : undefined}
      className={`flex w-full cursor-pointer flex-col gap-xs rounded-md border p-md text-left text-foreground hover:bg-border ${
        selecionado ? 'border-foreground bg-border' : 'border-border bg-surface'
      }`}
      onClick={onAbrir}
    >
      <span className="font-heading font-semibold tabular-nums">
        {item.respondidoEm ? formatarDataHora(item.respondidoEm) : 'Sem data'}
      </span>
      <span className="text-sm text-foreground-muted">
        {item.modelo.nome} · versão <span className="tabular-nums">{item.versao}</span>
      </span>
    </button>
  );
}

/** Uma anamnese aberta: as perguntas da versão respondida e o que o aluno respondeu. */
function Detalhe({ alunoId, submissaoId }: { alunoId: string; submissaoId: string }): ReactElement {
  const submissao = useAsync(
    async (signal) => anamnesesApi.buscar(alunoId, submissaoId, signal),
    [alunoId, submissaoId],
  );

  if (submissao.status === 'loading') {
    return <LoadingState label="Carregando respostas…" />;
  }
  if (submissao.status === 'error') {
    return (
      <ErroAoCarregar
        error={submissao.error}
        title="Não conseguimos abrir esta anamnese"
        onRetry={submissao.reload}
      />
    );
  }

  return <Respostas submissao={submissao.data} />;
}

/** Perguntas e respostas de um questionário enviado (usado também na leitura do feedback). */
export function Respostas({ submissao }: { submissao: Submissao }): ReactElement {
  return (
    <article className="min-w-0 rounded-md border border-border bg-surface p-md">
      <header className="mb-md">
        <h3 className="m-0 text-lg">
          {submissao.respondidoEm ? formatarDataHora(submissao.respondidoEm) : 'Sem data'}
        </h3>
        <p className="m-0 mt-xs text-sm text-foreground-muted">
          {submissao.modelo.nome} · versão{' '}
          <span className="font-heading tabular-nums">{submissao.versao}</span> do modelo
        </p>
        <p className="m-0 mt-xs text-sm text-foreground-muted">
          As perguntas aparecem como estavam nesta versão.
        </p>
      </header>

      <dl className="m-0 grid gap-md">
        {submissao.perguntas.map((pergunta) => {
          const valor = formatarValor(pergunta);
          return (
            <div key={pergunta.id} className="border-t border-border pt-md">
              <dt className="font-semibold">
                <span className="font-heading tabular-nums text-foreground-muted">
                  {pergunta.ordem}.
                </span>{' '}
                {pergunta.enunciado}
              </dt>
              <dd
                className={`m-0 mt-xs whitespace-pre-wrap break-words ${
                  valor === null ? 'italic text-foreground-muted' : ''
                }`}
              >
                {valor ?? 'Sem resposta'}
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

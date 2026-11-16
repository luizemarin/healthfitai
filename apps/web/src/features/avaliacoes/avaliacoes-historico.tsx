import { useState } from 'react';

import { Link, useSearchParams } from 'react-router';

import { avaliacoesApi } from './avaliacoes-api';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarDataHora } from '../alunos/aluno-formato';
import { formatarValor, mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type {
  PerguntaRespondida,
  Submissao,
  SubmissaoResumo,
} from '../questionarios/questionarios-api';

const dataDe = (item: { respondidoEm: string | null }): string =>
  item.respondidoEm ? formatarDataHora(item.respondidoEm) : 'Sem data';

/**
 * FE-AVA-02 · Histórico de avaliações (aba "Avaliações" da ficha).
 * Lista as avaliações por data (mais recente primeiro) e compara as marcadas lado a lado,
 * da mais antiga para a mais nova. Começa com as duas mais recentes marcadas.
 */
export function AvaliacoesHistorico({ alunoId }: { alunoId: string }): ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const lista = useAsync(
    async (signal) => avaliacoesApi.listar(alunoId, page, signal),
    [alunoId, page],
  );

  const novaAvaliacao = (
    <Link to={`/alunos/${alunoId}/avaliacoes/nova`} className="hf-button">
      Nova avaliação
    </Link>
  );

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

  if (lista.status === 'loading') {
    return <LoadingState label="Carregando avaliações…" />;
  }
  if (lista.status === 'error') {
    return (
      <ErrorState
        error={lista.error}
        title="Não conseguimos carregar as avaliações"
        message={mensagemDaApi(lista.error)}
        onRetry={lista.reload}
      />
    );
  }

  const { data, meta } = lista.data;
  if (data.length === 0) {
    return (
      <EmptyState
        title="Nenhuma avaliação registrada"
        description="Registre a primeira avaliação físico-postural do aluno. Cada nova avaliação fica guardada por data para comparar a evolução."
        action={novaAvaliacao}
      />
    );
  }

  return (
    <div className="grid gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <p className="m-0 text-foreground-muted">Marque as avaliações que quer comparar.</p>
        {novaAvaliacao}
      </div>

      {/* key: ao trocar de página, a seleção recomeça com as duas mais recentes da página. */}
      <Comparacao key={meta.page} alunoId={alunoId} itens={data} />

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
    </div>
  );
}

function Comparacao({
  alunoId,
  itens,
}: {
  alunoId: string;
  itens: SubmissaoResumo[];
}): ReactElement {
  const [marcadas, setMarcadas] = useState<string[]>(() =>
    itens.slice(0, 2).map((item) => item.id),
  );

  const alternar = (id: string, marcar: boolean): void => {
    setMarcadas((atual) => (marcar ? [...atual, id] : atual.filter((item) => item !== id)));
  };

  // Mais antiga → mais nova: a evolução se lê da esquerda para a direita.
  const ids = itens
    .filter((item) => marcadas.includes(item.id))
    .reverse()
    .map((item) => item.id);

  return (
    <div className="grid gap-lg lg:grid-cols-[280px_minmax(0,1fr)]">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Avaliações por data</legend>
        <ul className="m-0 grid list-none gap-sm p-0">
          {itens.map((item) => {
            const marcada = marcadas.includes(item.id);
            return (
              <li key={item.id}>
                <label
                  htmlFor={`avaliacao-${item.id}`}
                  className={`flex cursor-pointer items-start gap-sm rounded-md border p-md hover:bg-border ${
                    marcada ? 'border-foreground bg-border' : 'border-border bg-surface'
                  }`}
                >
                  <input
                    id={`avaliacao-${item.id}`}
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    checked={marcada}
                    onChange={(event) => alternar(item.id, event.target.checked)}
                  />
                  <span className="flex flex-col gap-xs">
                    <span className="font-heading font-semibold tabular-nums">{dataDe(item)}</span>
                    <span className="text-sm text-foreground-muted">
                      {item.modelo.nome} · versão{' '}
                      <span className="tabular-nums">{item.versao}</span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {ids.length === 0 ? (
        <EmptyState
          title="Nenhuma avaliação marcada"
          description="Marque uma ou mais avaliações na lista para ver os resultados lado a lado."
        />
      ) : (
        <TabelaComparativa alunoId={alunoId} ids={ids} />
      )}
    </div>
  );
}

/** Busca as avaliações marcadas e monta a tabela: uma linha por pergunta, uma coluna por data. */
function TabelaComparativa({ alunoId, ids }: { alunoId: string; ids: string[] }): ReactElement {
  const chave = ids.join(',');
  const avaliacoes = useAsync(
    async (signal) =>
      Promise.all(chave.split(',').map(async (id) => avaliacoesApi.buscar(alunoId, id, signal))),
    [alunoId, chave],
  );

  if (avaliacoes.status === 'loading') {
    return <LoadingState label="Carregando resultados…" />;
  }
  if (avaliacoes.status === 'error') {
    return (
      <ErrorState
        error={avaliacoes.error}
        title="Não conseguimos carregar os resultados"
        message={mensagemDaApi(avaliacoes.error)}
        onRetry={avaliacoes.reload}
      />
    );
  }

  const colunas = avaliacoes.data;
  const linhas = linhasDaComparacao(colunas);

  return (
    <div className="hf-table-scroll min-w-0 rounded-md border border-border bg-surface">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Comparação das avaliações marcadas</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="min-w-[200px] p-md align-bottom">
              Teste
            </th>
            {colunas.map((coluna) => (
              <th key={coluna.id} scope="col" className="min-w-[180px] p-md align-bottom">
                <span className="block font-heading tabular-nums">{dataDe(coluna)}</span>
                <span className="block text-sm font-normal text-foreground-muted">
                  {coluna.modelo.nome} · v<span className="tabular-nums">{coluna.versao}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.enunciado} className="border-b border-border last:border-b-0">
              <th scope="row" className="p-md align-top font-semibold">
                {linha.enunciado}
              </th>
              {colunas.map((coluna) => {
                const pergunta = linha.porAvaliacao.get(coluna.id);
                const valor = pergunta ? formatarValor(pergunta) : null;
                return (
                  <td
                    key={coluna.id}
                    className={`whitespace-pre-wrap break-words p-md align-top ${
                      valor === null ? 'italic text-foreground-muted' : ''
                    }`}
                  >
                    {valor ?? (pergunta ? 'Sem resposta' : 'Não avaliado')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Linha {
  enunciado: string;
  porAvaliacao: Map<string, PerguntaRespondida>;
}

/**
 * Junta as perguntas das avaliações pelo enunciado: cada versão do modelo tem ids próprios
 * de pergunta (BE-QST-04), então o texto é o que liga "o mesmo teste" entre as datas.
 * Ordem das linhas: a da avaliação mais nova; perguntas que só existiam antes vão ao final.
 * Pergunta que não existia naquela versão aparece como "Não avaliado".
 */
function linhasDaComparacao(colunas: Submissao[]): Linha[] {
  const linhas = new Map<string, Linha>();
  [...colunas].reverse().forEach((avaliacao) => {
    avaliacao.perguntas.forEach((pergunta) => {
      const linha = linhas.get(pergunta.enunciado) ?? {
        enunciado: pergunta.enunciado,
        porAvaliacao: new Map<string, PerguntaRespondida>(),
      };
      linha.porAvaliacao.set(avaliacao.id, pergunta);
      linhas.set(pergunta.enunciado, linha);
    });
  });
  return [...linhas.values()];
}

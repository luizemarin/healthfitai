import { useState } from 'react';

import { Link, useSearchParams } from 'react-router';

import { nutricaoApi } from './nutricao-api';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarDataHora } from '../alunos/aluno-formato';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { PlanoNutricional } from './nutricao-api';

/**
 * FE-NUT-01 · Planejamento nutricional (aba "Nutrição" da ficha).
 * Plano em uso (criar, editar, encerrar) e, abaixo, o histórico dos planos antigos.
 * Regras do back (BE-NUT-01): o aluno tem no máximo um plano em uso; criar um novo
 * manda o atual para o histórico; nada é apagado.
 */
export function NutricaoPainel({ alunoId }: { alunoId: string }): ReactElement {
  const ativo = useAsync(async (signal) => nutricaoApi.buscarAtivo(alunoId, signal), [alunoId]);
  // Muda ao encerrar o plano: o histórico busca de novo (o plano encerrado entra lá).
  const [versaoHistorico, setVersaoHistorico] = useState(0);

  const aoEncerrar = (): void => {
    ativo.reload();
    setVersaoHistorico((atual) => atual + 1);
  };

  return (
    <div className="grid gap-xl">
      <section aria-labelledby="plano-em-uso-titulo" className="grid gap-md">
        <h2 id="plano-em-uso-titulo" className="m-0">
          Plano em uso
        </h2>
        {ativo.status === 'loading' && <LoadingState label="Carregando plano nutricional…" />}
        {ativo.status === 'error' && (
          <ErrorState
            error={ativo.error}
            title="Não conseguimos carregar o plano nutricional"
            message={mensagemDaApi(ativo.error)}
            onRetry={ativo.reload}
          />
        )}
        {ativo.status === 'success' &&
          (ativo.data ? (
            <PlanoEmUso alunoId={alunoId} plano={ativo.data} onEncerrado={aoEncerrar} />
          ) : (
            <EmptyState
              title="Nenhum plano em uso"
              description="Monte o plano alimentar do aluno com as refeições do dia."
              action={
                <Link to={`/alunos/${alunoId}/nutricao/novo`} className="hf-button">
                  Criar plano
                </Link>
              }
            />
          ))}
      </section>

      <Historico key={versaoHistorico} alunoId={alunoId} />
    </div>
  );
}

/** Plano em uso: dados, refeições e as ações (editar, novo plano, encerrar). */
function PlanoEmUso({
  alunoId,
  plano,
  onEncerrado,
}: {
  alunoId: string;
  plano: PlanoNutricional;
  onEncerrado: () => void;
}): ReactElement {
  const toast = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const encerrar = async (): Promise<void> => {
    setEncerrando(true);
    try {
      await nutricaoApi.encerrar(plano.id);
      toast.success('Plano encerrado.', 'Ele continua no histórico do aluno.');
      setConfirmar(false);
      onEncerrado();
    } catch (error) {
      // Ex.: o plano já foi substituído ou encerrado — o back explica.
      avisarErro(toast, error, 'Não foi possível encerrar');
      setConfirmar(false);
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <article className="grid gap-md rounded-md border border-border bg-surface p-md">
      <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="font-heading text-lg font-semibold">{plano.nome}</span>
          <span className="text-sm text-foreground-muted">
            Criado em {formatarDataHora(plano.criadoEm)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col gap-3 md:flex-row">
          <Link
            to={`/alunos/${alunoId}/nutricao/${plano.id}`}
            className="hf-button hf-button--secondary"
          >
            Editar
          </Link>
          <Link to={`/alunos/${alunoId}/nutricao/novo`} className="hf-button hf-button--secondary">
            Novo plano
          </Link>
          <button
            type="button"
            className="hf-button hf-button--danger"
            disabled={encerrando}
            onClick={() => setConfirmar(true)}
          >
            Encerrar
          </button>
        </div>
      </div>

      <DetalhePlano plano={plano} />

      <ConfirmDialog
        open={confirmar}
        title="Encerrar o plano?"
        message="O aluno fica sem plano em uso. Nada é apagado: este plano continua no histórico."
        confirmLabel="Encerrar"
        danger
        busy={encerrando}
        onConfirm={() => void encerrar()}
        onCancel={() => setConfirmar(false)}
      />
    </article>
  );
}

/** Observações e refeições na ordem do dia (usado no plano em uso e no histórico). */
function DetalhePlano({ plano }: { plano: PlanoNutricional }): ReactElement {
  return (
    <div className="grid gap-md">
      {plano.observacoes && (
        <p className="m-0 whitespace-pre-line text-foreground-muted">{plano.observacoes}</p>
      )}
      <ol className="m-0 grid list-none gap-sm p-0">
        {plano.refeicoes.map((item) => (
          <li key={item.id} className="grid gap-xs rounded-md border border-border p-md">
            <span className="flex flex-wrap items-baseline gap-sm">
              <span className="font-heading font-semibold">{item.refeicao}</span>
              {item.horario && (
                <span className="font-heading text-sm text-foreground-muted tabular-nums">
                  {item.horario}
                </span>
              )}
            </span>
            <span className="whitespace-pre-line">{item.descricao}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Planos antigos (substituídos ou encerrados), do mais recente ao mais antigo. Só leitura. */
function Historico({ alunoId }: { alunoId: string }): ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const lista = useAsync(
    async (signal) => nutricaoApi.listarHistorico(alunoId, page, signal),
    [alunoId, page],
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

  let conteudo: ReactElement;
  if (lista.status === 'loading') {
    conteudo = <LoadingState label="Carregando histórico…" />;
  } else if (lista.status === 'error') {
    conteudo = (
      <ErrorState
        error={lista.error}
        title="Não conseguimos carregar o histórico"
        message={mensagemDaApi(lista.error)}
        onRetry={lista.reload}
      />
    );
  } else if (lista.data.data.length === 0) {
    conteudo = (
      <p className="m-0 text-foreground-muted">
        Os planos substituídos ou encerrados aparecem aqui.
      </p>
    );
  } else {
    const { data, meta } = lista.data;
    conteudo = (
      <>
        <ul className="m-0 grid list-none gap-sm p-0">
          {data.map((plano) => (
            <li key={plano.id}>
              <details className="rounded-md border border-border bg-surface p-md">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-sm">
                  <span className="font-heading font-semibold">{plano.nome}</span>
                  <span className="text-sm text-foreground-muted">
                    Criado em {formatarDataHora(plano.criadoEm)}
                  </span>
                </summary>
                <div className="pt-md">
                  <DetalhePlano plano={plano} />
                </div>
              </details>
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
    <section aria-labelledby="historico-titulo" className="grid gap-md">
      <h2 id="historico-titulo" className="m-0">
        Histórico
      </h2>
      {conteudo}
    </section>
  );
}

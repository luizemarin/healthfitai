import { Link, useSearchParams } from 'react-router';

import { STATUS_FEEDBACK, STATUS_LABEL } from './feedback-formato';
import { feedbacksApi } from './feedbacks-api';
import { StatusFeedbackBadge } from './status-feedback-badge';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarDataHora } from '../alunos/aluno-formato';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { FeedbackResumo, StatusFeedback } from './feedbacks-api';

/** Lê o status da URL; valor desconhecido = todos. */
function lerStatus(valor: string | null): StatusFeedback | undefined {
  return STATUS_FEEDBACK.find((status) => status === valor);
}

/** As datas que importam em cada status, em uma linha. */
function datasDoFeedback(item: FeedbackResumo): string {
  const partes: string[] = [];
  if (item.status === 'agendado') partes.push(`Criado em ${formatarDataHora(item.criadoEm)}`);
  if (item.enviadoEm) partes.push(`Enviado em ${formatarDataHora(item.enviadoEm)}`);
  if (item.lembretePrevistoEm)
    partes.push(`Lembrete em ${formatarDataHora(item.lembretePrevistoEm)}`);
  if (item.lembreteEm) partes.push(`Lembrete enviado em ${formatarDataHora(item.lembreteEm)}`);
  if (item.respondidoEm) partes.push(`Respondido em ${formatarDataHora(item.respondidoEm)}`);
  return partes.join(' · ');
}

/**
 * FE-FBK-02 · Painel de feedbacks do aluno (aba "Feedbacks" da ficha).
 * Lista os feedbacks (mais recentes primeiro) com filtro por status:
 * agendado, enviado, respondido ou atrasado. O filtro fica na URL (?aba=feedbacks&status=…).
 * Cada item abre a leitura e os comentários (FE-FBK-03).
 */
export function FeedbacksPainel({ alunoId }: { alunoId: string }): ReactElement {
  const [params, setParams] = useSearchParams();
  const status = lerStatus(params.get('status'));
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const lista = useAsync(
    async (signal) => feedbacksApi.listar(alunoId, { status, page }, signal),
    [alunoId, status, page],
  );

  /** Troca o filtro (volta para a página 1) ou a página. */
  const trocar = (nome: 'status' | 'pagina', valor: string): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        if (valor) novo.set(nome, valor);
        else novo.delete(nome);
        if (nome === 'status') novo.delete('pagina');
        return novo;
      },
      { replace: true },
    );
  };

  const agendar = (
    <Link to={`/alunos/${alunoId}/feedbacks/agendar`} className="hf-button">
      Agendar feedback
    </Link>
  );

  let conteudo: ReactElement;
  if (lista.status === 'loading') {
    conteudo = <LoadingState label="Carregando feedbacks…" />;
  } else if (lista.status === 'error') {
    conteudo = (
      <ErrorState
        error={lista.error}
        title="Não conseguimos carregar os feedbacks"
        message={mensagemDaApi(lista.error)}
        onRetry={lista.reload}
      />
    );
  } else if (lista.data.data.length === 0) {
    conteudo = status ? (
      <EmptyState
        title={`Nenhum feedback ${STATUS_LABEL[status].toLowerCase()}`}
        description="Escolha outro status ou veja todos."
        action={
          <button
            type="button"
            className="hf-button hf-button--secondary"
            onClick={() => trocar('status', '')}
          >
            Ver todos
          </button>
        }
      />
    ) : (
      <EmptyState
        title="Nenhum feedback ainda"
        description="Agende um feedback: o aluno recebe o link por e-mail na data escolhida."
        action={agendar}
      />
    );
  } else {
    const { data, meta } = lista.data;
    conteudo = (
      <>
        <ul className="m-0 grid list-none gap-sm p-0">
          {data.map((item) => (
            <li key={item.id}>
              <Link
                to={`/alunos/${alunoId}/feedbacks/${item.id}`}
                className="flex flex-col gap-xs rounded-md border border-border bg-surface p-md text-foreground no-underline hover:bg-border"
              >
                <span className="flex flex-wrap items-center gap-sm">
                  <span className="font-heading font-semibold">{item.modelo.nome}</span>
                  <StatusFeedbackBadge status={item.status} />
                </span>
                <span className="text-sm text-foreground-muted tabular-nums">
                  {datasDoFeedback(item)}
                </span>
                {item.totalComentarios > 0 && (
                  <span className="text-sm text-foreground-muted">
                    <span className="tabular-nums">{item.totalComentarios}</span>{' '}
                    {item.totalComentarios === 1 ? 'comentário' : 'comentários'}
                  </span>
                )}
              </Link>
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
      </>
    );
  }

  return (
    <div className="grid gap-lg">
      <div className="flex flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div className="md:w-[240px]">
          <Field id="filtro-status" label="Status">
            {(a11y) => (
              <select
                {...a11y}
                className="hf-input"
                value={status ?? ''}
                onChange={(event) => trocar('status', event.target.value)}
              >
                <option value="">Todos</option>
                {STATUS_FEEDBACK.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {STATUS_LABEL[opcao]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {agendar}
      </div>
      {conteudo}
    </div>
  );
}

import { useState } from 'react';

import { Link, useParams } from 'react-router';

import { MAX_TEXTO_COMENTARIO, STATUS_LABEL } from './feedback-formato';
import { feedbacksApi } from './feedbacks-api';
import { StatusFeedbackBadge } from './status-feedback-badge';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarDataHora } from '../alunos/aluno-formato';
import { alunosApi } from '../alunos/alunos-api';
import { Respostas } from '../questionarios/anamnese-respondida';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement } from 'react';

import type { Comentario, Feedback } from './feedbacks-api';

/**
 * FE-FBK-03 · Ler e comentar feedback (/alunos/:id/feedbacks/:feedbackId).
 * Mostra o que o aluno respondeu e os comentários do profissional (visíveis ao aluno).
 * Só dá para comentar depois da resposta (regra do back, BE-FBK-05).
 * Nada é sobrescrito: para corrigir um comentário, escreve-se outro.
 */
export function FeedbackDetalhePage(): ReactElement {
  const { id = '', feedbackId = '' } = useParams();
  const voltar = `/alunos/${id}?aba=feedbacks`;
  const dados = useAsync(
    async (signal) => {
      const [aluno, feedback] = await Promise.all([
        alunosApi.buscar(id, signal),
        feedbacksApi.buscar(id, feedbackId, signal),
      ]);
      return { aluno, feedback };
    },
    [id, feedbackId],
  );

  let conteudo: ReactElement;
  if (dados.status === 'loading') {
    conteudo = <LoadingState label="Carregando feedback…" />;
  } else if (dados.status === 'error') {
    conteudo = (
      <ErrorState
        error={dados.error}
        title="Não conseguimos abrir o feedback"
        message={mensagemDaApi(dados.error)}
        onRetry={dados.reload}
        action={
          <Link to={voltar} className="hf-button hf-button--secondary">
            Voltar à ficha
          </Link>
        }
      />
    );
  } else {
    conteudo = <Detalhe alunoId={id} feedback={dados.data.feedback} />;
  }

  return (
    <>
      <Link to={voltar} className="mb-md inline-flex min-h-11 items-center text-foreground-muted">
        ← Feedbacks do aluno
      </Link>
      <h1>Feedback</h1>
      {dados.status === 'success' && (
        <p className="-mt-xs mb-lg text-foreground-muted">{dados.data.aluno.nome}</p>
      )}
      {conteudo}
    </>
  );
}

function Detalhe({ alunoId, feedback }: { alunoId: string; feedback: Feedback }): ReactElement {
  // Comentário novo entra no fim da lista, sem recarregar a tela.
  const [comentarios, setComentarios] = useState<Comentario[]>(feedback.comentarios);

  return (
    <div className="grid max-w-[800px] gap-lg">
      <Resumo feedback={feedback} />

      {feedback.submissaoId ? (
        <RespostasDoAluno alunoId={alunoId} submissaoId={feedback.submissaoId} />
      ) : (
        <EmptyState
          title="O aluno ainda não respondeu"
          description={`Situação atual: ${STATUS_LABEL[feedback.status].toLowerCase()}. As respostas aparecem aqui quando o aluno enviar.`}
        />
      )}

      <section className="grid gap-md">
        <h2 className="m-0">Comentários</h2>
        <p className="m-0 text-sm text-foreground-muted">O aluno vê os comentários no app.</p>
        <ListaComentarios comentarios={comentarios} />
        {feedback.status === 'respondido' ? (
          <NovoComentario
            alunoId={alunoId}
            feedbackId={feedback.id}
            onComentado={(novo) => setComentarios((atual) => [...atual, novo])}
          />
        ) : (
          <p className="m-0 text-foreground-muted">
            Você poderá comentar depois que o aluno responder.
          </p>
        )}
      </section>
    </div>
  );
}

/** Modelo, status e datas do feedback. */
function Resumo({ feedback }: { feedback: Feedback }): ReactElement {
  const datas: [string, string | null][] = [
    ['Enviado em', feedback.enviadoEm],
    ['Lembrete previsto para', feedback.lembretePrevistoEm],
    ['Lembrete enviado em', feedback.lembreteEm],
    ['Respondido em', feedback.respondidoEm],
  ];

  return (
    <section className="rounded-md border border-border bg-surface p-md">
      <div className="flex flex-wrap items-center gap-sm">
        <h2 className="m-0 text-lg md:text-lg">{feedback.modelo.nome}</h2>
        <StatusFeedbackBadge status={feedback.status} />
      </div>
      <dl className="m-0 mt-md grid gap-sm md:grid-cols-2">
        {datas
          .filter((item): item is [string, string] => item[1] !== null)
          .map(([rotulo, data]) => (
            <div key={rotulo}>
              <dt className="text-sm text-foreground-muted">{rotulo}</dt>
              <dd className="m-0 font-heading tabular-nums">{formatarDataHora(data)}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

function RespostasDoAluno({
  alunoId,
  submissaoId,
}: {
  alunoId: string;
  submissaoId: string;
}): ReactElement {
  const respostas = useAsync(
    async (signal) => feedbacksApi.respostas(alunoId, submissaoId, signal),
    [alunoId, submissaoId],
  );

  if (respostas.status === 'loading') {
    return <LoadingState label="Carregando respostas…" />;
  }
  if (respostas.status === 'error') {
    return (
      <ErrorState
        error={respostas.error}
        title="Não conseguimos carregar as respostas"
        message={mensagemDaApi(respostas.error)}
        onRetry={respostas.reload}
      />
    );
  }
  return <Respostas submissao={respostas.data} />;
}

function ListaComentarios({ comentarios }: { comentarios: Comentario[] }): ReactElement {
  if (comentarios.length === 0) {
    return <p className="m-0 italic text-foreground-muted">Nenhum comentário ainda.</p>;
  }
  return (
    <ul className="m-0 grid list-none gap-sm p-0">
      {comentarios.map((comentario) => (
        <li key={comentario.id} className="rounded-md border border-border bg-surface p-md">
          <p className="m-0 text-sm text-foreground-muted tabular-nums">
            {formatarDataHora(comentario.criadoEm)}
          </p>
          <p className="m-0 mt-xs whitespace-pre-wrap break-words">{comentario.texto}</p>
        </li>
      ))}
    </ul>
  );
}

function NovoComentario({
  alunoId,
  feedbackId,
  onComentado,
}: {
  alunoId: string;
  feedbackId: string;
  onComentado: (comentario: Comentario) => void;
}): ReactElement {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    // Mesma regra do back: espaços nas pontas não contam.
    if (!texto.trim()) {
      setErro('O comentário não pode ficar vazio.');
      return;
    }

    setEnviando(true);
    try {
      onComentado(await feedbacksApi.comentar(alunoId, feedbackId, texto.trim()));
      setTexto('');
      toast.success('Comentário enviado.', 'O aluno já pode ver no app.');
    } catch (error) {
      const doCampo =
        error instanceof ApiError
          ? error.details.find((detalhe) => detalhe.field === 'body.texto')
          : undefined;
      if (doCampo) {
        setErro(doCampo.message);
      } else {
        // Ex.: "O aluno está inativo. Reative o aluno para comentar o feedback."
        avisarErro(toast, error, 'Não foi possível enviar o comentário');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      noValidate
      className="grid gap-md"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <Field
        id="comentario"
        label="Novo comentário"
        hint={`Até ${MAX_TEXTO_COMENTARIO} caracteres. Depois de enviado, não dá para editar.`}
        error={erro}
      >
        {(a11y) => (
          <textarea
            {...a11y}
            className="hf-input min-h-28"
            maxLength={MAX_TEXTO_COMENTARIO}
            value={texto}
            onChange={(event) => {
              setTexto(event.target.value);
              if (erro) setErro(undefined);
            }}
          />
        )}
      </Field>
      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        <button type="submit" className="hf-button" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar comentário'}
        </button>
      </div>
    </form>
  );
}

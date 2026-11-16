import { useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import {
  diaDoMesEmBrasilia,
  MAX_LEMBRETE_DIAS,
  RECORRENCIA_LABEL,
  RECORRENCIAS,
  ULTIMO_DIA_MENSAL,
} from './feedback-formato';
import { feedbacksApi } from './feedbacks-api';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { alunosApi } from '../alunos/alunos-api';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement } from 'react';

import type { Recorrencia } from './feedbacks-api';
import type { ApiErrorDetail } from '../../api/api-error';
import type { ModeloResumo } from '../questionarios/questionarios-api';

/** Campos do formulário; o nome é também o id do campo na página. */
type Campo = 'modelo' | 'recorrencia' | 'liberacao' | 'lembrete';
type Erros = Partial<Record<Campo, string>>;
const ORDEM: Campo[] = ['modelo', 'recorrencia', 'liberacao', 'lembrete'];

/** Campo do back (details[].field) → campo da tela. */
const CAMPO_DA_API: Record<string, Campo> = {
  'body.modeloId': 'modelo',
  'body.recorrencia': 'recorrencia',
  'body.primeiraLiberacao': 'liberacao',
  'body.lembreteDias': 'lembrete',
};

/** "AAAA-MM-DDTHH:MM" de agora no fuso do navegador (mínimo do campo de data e hora). */
function agoraLocal(): string {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 16);
}

interface Valores {
  modeloId: string;
  recorrencia: Recorrencia;
  /** Valor do campo datetime-local, no fuso do navegador. */
  liberacao: string;
  /** Vazio = sem lembrete. */
  lembrete: string;
}

/** Mesmas regras e mensagens do back (BE-FBK-01/03); vazio = tudo certo. */
function validar({ modeloId, recorrencia, liberacao, lembrete }: Valores): Erros {
  const erros: Erros = {};
  if (!modeloId) erros.modelo = 'Escolha o modelo de feedback.';

  if (!liberacao) {
    erros.liberacao = 'Informe a data e a hora da primeira liberação.';
  } else {
    const data = new Date(liberacao);
    if (data.getTime() < Date.now()) {
      erros.liberacao = 'A data da liberação não pode estar no passado.';
    } else if (recorrencia === 'mensal' && diaDoMesEmBrasilia(data) > ULTIMO_DIA_MENSAL) {
      erros.liberacao = `Na recorrência mensal, escolha um dia de 1 a ${ULTIMO_DIA_MENSAL} (nem todo mês tem 29, 30 ou 31 dias).`;
    }
  }

  if (lembrete.trim()) {
    const dias = Number(lembrete);
    const maximo = MAX_LEMBRETE_DIAS[recorrencia];
    if (!Number.isInteger(dias)) {
      erros.lembrete = 'O lembrete deve ser um número inteiro de dias.';
    } else if (dias < 1) {
      erros.lembrete = 'O lembrete deve ser de pelo menos 1 dia.';
    } else if (dias > maximo) {
      erros.lembrete = `Com recorrência ${recorrencia}, o lembrete deve ser de no máximo ${maximo} dia(s), para sair antes do próximo feedback.`;
    }
  }
  return erros;
}

/** Erros da API → campo certo; o que não for de um campo vai para o aviso. */
function errosDaApi(details: readonly ApiErrorDetail[]): { porCampo: Erros; outros: string[] } {
  const porCampo: Erros = {};
  const outros: string[] = [];
  details.forEach(({ field, message }) => {
    const campo = CAMPO_DA_API[field];
    if (campo) porCampo[campo] ??= message;
    else outros.push(message);
  });
  return { porCampo, outros };
}

/**
 * FE-FBK-01 · Agendar feedback recorrente (/alunos/:id/feedbacks/agendar).
 * O profissional escolhe modelo, frequência, quando sai o primeiro e o lembrete.
 * O aluno vem da ficha de onde a tela foi aberta.
 */
export function FeedbackAgendarPage(): ReactElement {
  const { id = '' } = useParams();
  const voltar = `/alunos/${id}?aba=feedbacks`;
  const dados = useAsync(
    async (signal) => {
      const [aluno, modelos] = await Promise.all([
        alunosApi.buscar(id, signal),
        feedbacksApi.modelosAtivos(signal),
      ]);
      return { aluno, modelos: modelos.data };
    },
    [id],
  );

  let conteudo: ReactElement;
  if (dados.status === 'loading') {
    conteudo = <LoadingState label="Carregando…" />;
  } else if (dados.status === 'error') {
    conteudo = (
      <ErrorState
        error={dados.error}
        title="Não conseguimos abrir o agendamento"
        message={mensagemDaApi(dados.error)}
        onRetry={dados.reload}
      />
    );
  } else if (dados.data.modelos.length === 0) {
    conteudo = (
      <EmptyState
        title="Nenhum modelo de feedback ativo"
        description="Crie ou ative um modelo do tipo Feedback em Questionários para agendar feedbacks."
        action={
          <Link to="/questionarios?tipo=feedback" className="hf-button">
            Ir para Questionários
          </Link>
        }
      />
    );
  } else {
    conteudo = <Formulario alunoId={id} modelos={dados.data.modelos} voltar={voltar} />;
  }

  return (
    <>
      <Link to={voltar} className="mb-md inline-flex min-h-11 items-center text-foreground-muted">
        ← Ficha do aluno
      </Link>
      <h1>Agendar feedback</h1>
      {dados.status === 'success' && (
        <p className="-mt-xs mb-lg text-foreground-muted">{dados.data.aluno.nome}</p>
      )}
      {conteudo}
    </>
  );
}

function Formulario({
  alunoId,
  modelos,
  voltar,
}: {
  alunoId: string;
  modelos: ModeloResumo[];
  voltar: string;
}): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [valores, setValores] = useState<Valores>({
    modeloId: modelos.length === 1 ? (modelos[0]?.id ?? '') : '',
    recorrencia: 'semanal',
    liberacao: '',
    lembrete: '',
  });
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const alterar = <K extends keyof Valores>(campo: K, valor: Valores[K], erro: Campo): void => {
    setValores((atual) => ({ ...atual, [campo]: valor }));
    if (erros[erro]) setErros((atual) => ({ ...atual, [erro]: undefined }));
  };

  /** Mostra os erros e leva o foco ao primeiro campo com problema. */
  const mostrarErros = (novos: Erros): void => {
    setErros(novos);
    const primeiro = ORDEM.find((campo) => novos[campo]);
    if (primeiro) {
      setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${primeiro}`)?.focus());
    }
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const encontrados = validar(valores);
    if (Object.keys(encontrados).length > 0) {
      mostrarErros(encontrados);
      return;
    }

    setSalvando(true);
    try {
      await feedbacksApi.agendar(alunoId, {
        modeloId: valores.modeloId,
        recorrencia: valores.recorrencia,
        // datetime-local é a hora do navegador; a API recebe em ISO com fuso.
        primeiraLiberacao: new Date(valores.liberacao).toISOString(),
        lembreteDias: valores.lembrete.trim() ? Number(valores.lembrete) : null,
      });
      toast.success('Feedback agendado.');
      await navigate(voltar);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        const { porCampo, outros } = errosDaApi(error.details);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        // Ex.: "O aluno já tem um agendamento ativo com este modelo de feedback…"
        avisarErro(toast, error, 'Não foi possível agendar o feedback');
      }
    } finally {
      setSalvando(false);
    }
  };

  const maximo = MAX_LEMBRETE_DIAS[valores.recorrencia];

  return (
    <form
      ref={formRef}
      noValidate
      className="grid max-w-[640px] gap-md"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <p className="m-0 text-sm text-foreground-muted">
        Campos com <span className="text-danger">*</span> são obrigatórios.
      </p>

      <Field id="modelo" label="Modelo de feedback" required error={erros.modelo}>
        {(a11y) => (
          <select
            {...a11y}
            className="hf-input"
            value={valores.modeloId}
            onChange={(event) => alterar('modeloId', event.target.value, 'modelo')}
          >
            <option value="">Selecione</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="recorrencia" label="Frequência" required error={erros.recorrencia}>
        {(a11y) => (
          <select
            {...a11y}
            className="hf-input"
            value={valores.recorrencia}
            onChange={(event) =>
              alterar('recorrencia', event.target.value as Recorrencia, 'recorrencia')
            }
          >
            {RECORRENCIAS.map((recorrencia) => (
              <option key={recorrencia} value={recorrencia}>
                {RECORRENCIA_LABEL[recorrencia]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="liberacao"
        label={valores.recorrencia === 'avulso' ? 'Liberação' : 'Primeira liberação'}
        required
        hint={
          valores.recorrencia === 'mensal'
            ? `Quando o aluno recebe o feedback. Na frequência mensal, escolha um dia de 1 a ${ULTIMO_DIA_MENSAL}.`
            : 'Quando o aluno recebe o feedback por e-mail.'
        }
        error={erros.liberacao}
      >
        {(a11y) => (
          <input
            {...a11y}
            type="datetime-local"
            className="hf-input max-w-[280px]"
            min={agoraLocal()}
            value={valores.liberacao}
            onChange={(event) => alterar('liberacao', event.target.value, 'liberacao')}
          />
        )}
      </Field>

      <Field
        id="lembrete"
        label="Lembrete (dias sem resposta)"
        hint={`Deixe em branco para não enviar lembrete. Máximo de ${maximo} dia(s) nesta frequência.`}
        error={erros.lembrete}
      >
        {(a11y) => (
          <input
            {...a11y}
            type="number"
            inputMode="numeric"
            className="hf-input max-w-[160px]"
            min={1}
            max={maximo}
            step={1}
            value={valores.lembrete}
            onChange={(event) => alterar('lembrete', event.target.value, 'lembrete')}
          />
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-lg md:flex-row md:justify-end">
        <Link to={voltar} className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Agendando…' : 'Agendar feedback'}
        </button>
      </div>
    </form>
  );
}

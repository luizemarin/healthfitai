import { useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import { dataParaApi, hojeLocal, validarDataAvaliacao } from './avaliacao-data';
import { avaliacoesApi } from './avaliacoes-api';
import { CampoPergunta, idDoCampo, valorInicial, valorParaApi } from './campo-pergunta';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { alunosApi } from '../alunos/alunos-api';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement } from 'react';

import type { ValorCampo } from './campo-pergunta';
import type { ApiErrorDetail } from '../../api/api-error';
import type { ModeloResumo, Submissao } from '../questionarios/questionarios-api';

/** Erros do formulário: por id da pergunta, mais o campo da data. */
type Erros = Record<string, string | undefined>;
const CAMPO_DATA = 'data-avaliacao';

/**
 * FE-AVA-01 · Preenchimento da avaliação físico-postural (/alunos/:id/avaliacoes/nova).
 *   1. escolhe o modelo de avaliação (o padrão traz os 5 testes) e começa;
 *   2. preenche os testes e a data da avaliação;
 *   3. salvar → registro final, datado e imutável; volta para a aba Avaliações da ficha.
 * Começar retoma o rascunho daquele modelo, se houver (regra do back, BE-RSP-02).
 */
export function AvaliacaoNovaPage(): ReactElement {
  const { id = '' } = useParams();
  const voltar = `/alunos/${id}?aba=avaliacoes`;
  const dados = useAsync(
    async (signal) => {
      const [aluno, modelos] = await Promise.all([
        alunosApi.buscar(id, signal),
        avaliacoesApi.modelosAtivos(signal),
      ]);
      return { aluno, modelos: modelos.data };
    },
    [id],
  );

  let conteudo: ReactElement;
  if (dados.status === 'loading') {
    conteudo = <LoadingState label="Carregando avaliação…" />;
  } else if (dados.status === 'error') {
    conteudo = (
      <ErrorState
        error={dados.error}
        title="Não conseguimos abrir a avaliação"
        message={mensagemDaApi(dados.error)}
        onRetry={dados.reload}
      />
    );
  } else if (dados.data.modelos.length === 0) {
    conteudo = (
      <EmptyState
        title="Nenhum modelo de avaliação ativo"
        description="Crie ou ative um modelo do tipo Avaliação em Questionários para registrar avaliações."
        action={
          <Link to="/questionarios" className="hf-button">
            Ir para Questionários
          </Link>
        }
      />
    );
  } else {
    conteudo = <Preenchimento alunoId={id} modelos={dados.data.modelos} voltar={voltar} />;
  }

  return (
    <>
      <Link to={voltar} className="mb-md inline-flex min-h-11 items-center text-foreground-muted">
        ← Ficha do aluno
      </Link>
      <h1>Nova avaliação</h1>
      {dados.status === 'success' && (
        <p className="-mt-xs mb-lg text-foreground-muted">{dados.data.aluno.nome}</p>
      )}
      {conteudo}
    </>
  );
}

/** Escolha do modelo e, depois de começar, o formulário. */
function Preenchimento({
  alunoId,
  modelos,
  voltar,
}: {
  alunoId: string;
  modelos: ModeloResumo[];
  voltar: string;
}): ReactElement {
  const toast = useToast();
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? '');
  const [abrindo, setAbrindo] = useState(false);
  const [submissao, setSubmissao] = useState<Submissao | null>(null);

  // Abrir é uma ação (cria o rascunho no back), por isso fica no botão e não ao carregar a tela.
  const comecar = async (): Promise<void> => {
    setAbrindo(true);
    try {
      setSubmissao(await avaliacoesApi.abrir(alunoId, modeloId));
    } catch (error) {
      // Ex.: "O aluno está inativo. Reative o aluno para registrar respostas."
      avisarErro(toast, error, 'Não foi possível começar a avaliação');
    } finally {
      setAbrindo(false);
    }
  };

  if (submissao) {
    return <Formulario alunoId={alunoId} submissao={submissao} voltar={voltar} />;
  }

  return (
    <div className="grid max-w-[640px] gap-md">
      {modelos.length > 1 && (
        <Field id="modelo" label="Modelo de avaliação" required>
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={modeloId}
              onChange={(event) => setModeloId(event.target.value)}
            >
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nome}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {modelos.length === 1 && (
        <p className="m-0 text-foreground-muted">Modelo: {modelos[0]?.nome}</p>
      )}
      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link to={voltar} className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button
          type="button"
          className="hf-button"
          disabled={abrindo || !modeloId}
          onClick={() => void comecar()}
        >
          {abrindo ? 'Abrindo…' : 'Começar avaliação'}
        </button>
      </div>
    </div>
  );
}

/**
 * Erros da API → campo certo. O back aponta:
 *   perguntas.<id>               obrigatória sem resposta
 *   body.respostas.<i>.valor     valor inválido (i = posição na lista enviada)
 *   body.respondidoEm            data da avaliação
 */
function errosDaApi(
  details: readonly ApiErrorDetail[],
  perguntaIds: string[],
): { porCampo: Erros; outros: string[] } {
  const porCampo: Erros = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const obrigatoria = /^perguntas\.(.+)$/.exec(field)?.[1];
    const indice = /^body\.respostas\.(\d+)/.exec(field)?.[1];
    const campo =
      obrigatoria ??
      (indice === undefined ? undefined : perguntaIds[Number(indice)]) ??
      (field === 'body.respondidoEm' ? CAMPO_DATA : undefined);

    if (campo) {
      porCampo[campo] ??= message;
    } else {
      outros.push(message);
    }
  });
  return { porCampo, outros };
}

function Formulario({
  alunoId,
  submissao,
  voltar,
}: {
  alunoId: string;
  submissao: Submissao;
  voltar: string;
}): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { perguntas } = submissao;
  const [valores, setValores] = useState<Record<string, ValorCampo>>(() =>
    Object.fromEntries(perguntas.map((pergunta) => [pergunta.id, valorInicial(pergunta)])),
  );
  const [dataAvaliacao, setDataAvaliacao] = useState(hojeLocal);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  const limparErro = (campo: string): void => {
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const alterar = (perguntaId: string, valor: ValorCampo): void => {
    setValores((atual) => ({ ...atual, [perguntaId]: valor }));
    limparErro(perguntaId);
  };

  /** Mostra os erros e leva o foco ao primeiro campo com problema (na ordem da tela). */
  const mostrarErros = (novos: Erros): void => {
    setErros(novos);
    const primeiro = [CAMPO_DATA, ...perguntas.map((pergunta) => pergunta.id)].find(
      (campo) => novos[campo],
    );
    if (primeiro) {
      const alvo = primeiro === CAMPO_DATA ? CAMPO_DATA : idDoCampo(primeiro);
      setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${alvo}`)?.focus());
    }
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const erroData = validarDataAvaliacao(dataAvaliacao);
    if (erroData) {
      mostrarErros({ [CAMPO_DATA]: erroData });
      return;
    }

    setSalvando(true);
    try {
      // Todas as perguntas vão na lista: vazio = null, que apaga o que estava no rascunho.
      await avaliacoesApi.finalizar(alunoId, submissao.id, {
        respostas: perguntas.map((pergunta) => ({
          perguntaId: pergunta.id,
          valor: valorParaApi(pergunta, valores[pergunta.id] ?? null),
        })),
        respondidoEm: dataParaApi(dataAvaliacao),
      });
      toast.success('Avaliação registrada.');
      await navigate(voltar);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        const { porCampo, outros } = errosDaApi(
          error.details,
          perguntas.map((pergunta) => pergunta.id),
        );
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        avisarErro(toast, error, 'Não foi possível registrar a avaliação');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="grid max-w-[800px] gap-lg"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <p className="m-0 text-sm text-foreground-muted">
        {submissao.modelo.nome} · Campos com <span className="text-danger">*</span> são
        obrigatórios.
      </p>

      <Field
        id={CAMPO_DATA}
        label="Data da avaliação"
        required
        hint="Dia em que você avaliou o aluno."
        error={erros[CAMPO_DATA]}
      >
        {(a11y) => (
          <input
            {...a11y}
            type="date"
            className="hf-input max-w-[240px]"
            max={hojeLocal()}
            value={dataAvaliacao}
            onChange={(event) => {
              setDataAvaliacao(event.target.value);
              limparErro(CAMPO_DATA);
            }}
          />
        )}
      </Field>

      {perguntas.map((pergunta) => (
        <div key={pergunta.id} className="border-t border-border pt-lg">
          <CampoPergunta
            pergunta={pergunta}
            valor={valores[pergunta.id] ?? null}
            erro={erros[pergunta.id]}
            onChange={(valor) => alterar(pergunta.id, valor)}
          />
        </div>
      ))}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-lg md:flex-row md:justify-end">
        <Link to={voltar} className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Registrar avaliação'}
        </button>
      </div>
    </form>
  );
}

import { useRef, useState } from 'react';

import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { avisarErro } from './avisar-erro';
import { ConstrutorPerguntas } from './construtor-perguntas';
import {
  errosDaApi,
  formDoModelo,
  idDoCampo,
  novaPergunta,
  perguntaParaApi,
  validarModelo,
} from './modelo-validacao';
import { mensagemDaApi, TIPO_MODELO_LABEL, TIPOS_MODELO } from './questionario-formato';
import { modelosApi } from './questionarios-api';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { ErrorState, LoadingState, useAsync } from '../../components/states';

import type { FormEvent, ReactElement } from 'react';

import type { ErrosModelo, ModeloForm, PerguntaForm } from './modelo-validacao';
import type { Modelo, TipoModelo } from './questionarios-api';

const voltarParaLista = (tipo: TipoModelo | ''): string =>
  tipo ? `/questionarios?tipo=${tipo}` : '/questionarios';

/** FE-QST-01/02 · Criar modelo (/questionarios/novo?tipo=anamnese). */
export function ModeloNovoPage(): ReactElement {
  const [params] = useSearchParams();
  const tipo = params.get('tipo');
  const inicial: ModeloForm = {
    tipo: TIPOS_MODELO.includes(tipo as TipoModelo) ? (tipo as TipoModelo) : '',
    nome: '',
    sexoAlvo: '',
    perguntas: [novaPergunta()],
  };

  return (
    <>
      <h1>Criar modelo</h1>
      <ModeloFormulario inicial={inicial} />
    </>
  );
}

/**
 * FE-QST-01/02 · Abrir um modelo (/questionarios/:id): editar o seu modelo, ou só ver
 * quando for padrão do sistema ou estiver inativo (o back não deixa editar nesses casos).
 */
export function ModeloEditarPage(): ReactElement {
  const { id = '' } = useParams();
  const modelo = useAsync(async (signal) => modelosApi.buscar(id, signal), [id]);
  const voltar = (
    <Link to="/questionarios" className="hf-button hf-button--secondary">
      Voltar aos questionários
    </Link>
  );

  if (modelo.status === 'loading') {
    return <LoadingState label="Carregando modelo…" />;
  }

  if (modelo.status === 'error') {
    // Ex.: "Modelo de questionário não encontrado." (mensagem do back quando houver).
    return (
      <ErrorState
        error={modelo.error}
        title="Não conseguimos abrir o modelo"
        message={mensagemDaApi(modelo.error)}
        onRetry={modelo.reload}
        action={voltar}
      />
    );
  }

  const dados = modelo.data;
  const somenteLeitura = dados.padrao || !dados.ativo;

  return (
    <>
      <h1>{somenteLeitura ? dados.nome : 'Editar modelo'}</h1>
      {somenteLeitura && <AvisoSomenteLeitura modelo={dados} onAtivado={modelo.reload} />}
      {/* key: ao recarregar (ex.: depois de ativar), o formulário recomeça com os dados novos. */}
      <ModeloFormulario
        key={`${dados.id}-${String(dados.versao)}-${String(dados.ativo)}`}
        modelo={dados}
        inicial={formDoModelo(dados)}
        somenteLeitura={somenteLeitura}
      />
    </>
  );
}

/** Explica por que o modelo não pode ser editado e oferece o caminho (duplicar ou ativar). */
function AvisoSomenteLeitura({
  modelo,
  onAtivado,
}: {
  modelo: Modelo;
  onAtivado: () => void;
}): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);

  const duplicar = async (): Promise<void> => {
    setOcupado(true);
    try {
      const copia = await modelosApi.duplicar(modelo.id);
      toast.success('Modelo duplicado.', `"${copia.nome}" já pode ser editado.`);
      await navigate(`/questionarios/${copia.id}`);
    } catch (error) {
      avisarErro(toast, error, 'Não foi possível duplicar');
    } finally {
      setOcupado(false);
    }
  };

  const ativar = async (): Promise<void> => {
    setOcupado(true);
    try {
      await modelosApi.ativar(modelo.id);
      toast.success('Modelo ativado.', 'Agora você pode editar.');
      onAtivado();
    } catch (error) {
      avisarErro(toast, error, 'Não foi possível ativar');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div
      role="status"
      className="mb-lg flex flex-col gap-md rounded-md border border-border bg-surface p-md md:flex-row md:items-center md:justify-between"
    >
      <p className="m-0">
        {modelo.padrao
          ? 'Este é um modelo padrão do sistema e não pode ser alterado. Duplique para personalizar.'
          : 'Este modelo está inativo. Ative o modelo para editar.'}
      </p>
      <button
        type="button"
        className="hf-button shrink-0"
        disabled={ocupado}
        onClick={() => void (modelo.padrao ? duplicar() : ativar())}
      >
        {modelo.padrao ? 'Duplicar' : 'Ativar'}
      </button>
    </div>
  );
}

interface ModeloFormularioProps {
  /** Sem modelo = criação; com modelo = edição. */
  modelo?: Modelo;
  inicial: ModeloForm;
  somenteLeitura?: boolean;
}

/**
 * Formulário do modelo (FE-QST-01) com o construtor de perguntas (FE-QST-02). Fluxo ao salvar:
 *   1. valida tudo com as mesmas regras do back → erros aparecem embaixo de cada campo;
 *   2. envia → se o back recusar, os erros dele vão para os campos (ou para o aviso);
 *   3. deu certo → aviso de sucesso e volta para a lista.
 */
function ModeloFormulario({
  modelo,
  inicial,
  somenteLeitura = false,
}: ModeloFormularioProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ModeloForm>(inicial);
  const [erros, setErros] = useState<ErrosModelo>({});
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(modelo);

  /** Tira os erros que já não valem (os de um campo, ou todos os das perguntas). */
  const limparErros = (deveSair: (caminho: string) => boolean): void => {
    setErros((atual) =>
      Object.fromEntries(Object.entries(atual).filter(([caminho]) => !deveSair(caminho))),
    );
  };

  const alterarCampo = (campo: 'tipo' | 'nome' | 'sexoAlvo', valor: string): void => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    limparErros((caminho) => caminho === campo);
  };

  const alterarPergunta = (
    indice: number,
    alteracao: Partial<PerguntaForm>,
    campo: keyof PerguntaForm,
  ): void => {
    setForm((atual) => ({
      ...atual,
      perguntas: atual.perguntas.map((pergunta, posicao) =>
        posicao === indice ? { ...pergunta, ...alteracao } : pergunta,
      ),
    }));
    const prefixo = `perguntas.${String(indice)}.`;
    // Trocar o tipo muda os campos da pergunta: os erros dela toda deixam de valer.
    limparErros((caminho) =>
      campo === 'tipo' ? caminho.startsWith(prefixo) : caminho === `${prefixo}${campo}`,
    );
  };

  /** Adicionar/remover/reordenar muda as posições: os erros das perguntas deixam de valer. */
  const reordenar = (perguntas: PerguntaForm[]): void => {
    setForm((atual) => ({ ...atual, perguntas }));
    limparErros((caminho) => caminho.startsWith('perguntas'));
  };

  const adicionar = (): void => {
    const indice = form.perguntas.length;
    reordenar([...form.perguntas, novaPergunta()]);
    setTimeout(() => document.getElementById(`perguntas-${String(indice)}-enunciado`)?.focus());
  };

  /** Mostra os erros e leva o foco ao primeiro campo com problema (na ordem da tela). */
  const mostrarErros = (novos: ErrosModelo): void => {
    setErros(novos);
    setTimeout(() => {
      const campos = Object.keys(novos).map((caminho) => `#${idDoCampo(caminho)}`);
      if (campos.length > 0) {
        formRef.current?.querySelector<HTMLElement>(campos.join(','))?.focus();
      }
    });
  };

  const salvar = async (): Promise<Modelo> => {
    const nome = form.nome.trim();
    const sexoAlvo = form.sexoAlvo || null;
    const perguntas = form.perguntas.map(perguntaParaApi);

    if (modelo) {
      // `versao`: se outra edição salvou antes, o back recusa (409) em vez de sobrescrever.
      return modelosApi.editar(modelo.id, { versao: modelo.versao, nome, sexoAlvo, perguntas });
    }
    return modelosApi.criar({ tipo: form.tipo as TipoModelo, nome, sexoAlvo, perguntas });
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (somenteLeitura) return;

    const errosLocais = validarModelo(form);
    if (Object.keys(errosLocais).length > 0) {
      mostrarErros(errosLocais);
      toast.error(
        'Verifique os campos destacados',
        'Corrija os campos em vermelho e tente de novo.',
      );
      return;
    }

    setSalvando(true);
    try {
      const salvo = await salvar();
      if (!modelo) {
        toast.success('Modelo criado.');
      } else if (salvo.versao !== modelo.versao) {
        toast.success(
          `Modelo salvo na versão ${String(salvo.versao)}.`,
          'As respostas já registradas continuam na versão em que foram respondidas.',
        );
      } else {
        toast.success('Modelo salvo.');
      }
      await navigate(voltarParaLista(salvo.tipo));
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        // Validação recusada pelo back: cada erro vai para o seu campo; o resto, para o aviso.
        const { porCampo, outros } = errosDaApi(error.details);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        // Ex.: modelo alterado por outra pessoa (409), sem conexão, servidor fora.
        avisarErro(toast, error, editando ? 'Não foi possível salvar' : 'Não foi possível criar');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      ref={formRef}
      // noValidate: a validação é nossa (mesmas regras e mensagens do back), não a do navegador.
      noValidate
      className="grid max-w-[800px] gap-lg"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      {/* Só leitura: um fieldset desabilitado trava todos os campos e botões de uma vez. */}
      <fieldset disabled={somenteLeitura} className="m-0 grid min-w-0 gap-lg border-0 p-0">
        {!somenteLeitura && (
          <p className="m-0 text-sm text-foreground-muted">
            Campos com <span className="text-danger">*</span> são obrigatórios.
          </p>
        )}

        <div className="grid gap-md md:grid-cols-2">
          <Field id="nome" label="Nome" required error={erros['nome']}>
            {(a11y) => (
              <input
                {...a11y}
                className="hf-input"
                autoComplete="off"
                maxLength={120}
                placeholder="Ex.: Anamnese inicial"
                value={form.nome}
                onChange={(event) => alterarCampo('nome', event.target.value)}
              />
            )}
          </Field>

          <Field
            id="tipo"
            label="Tipo"
            required
            hint={editando ? 'O tipo não muda depois de criado.' : undefined}
            error={erros['tipo']}
          >
            {(a11y) => (
              <select
                {...a11y}
                className="hf-input"
                disabled={editando}
                value={form.tipo}
                onChange={(event) => alterarCampo('tipo', event.target.value)}
              >
                <option value="">Selecione</option>
                {TIPOS_MODELO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_MODELO_LABEL[tipo]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="sexoAlvo"
            label="Para qual sexo"
            hint="Na anamnese, o sistema escolhe o modelo pelo sexo do aluno."
            error={erros['sexoAlvo']}
          >
            {(a11y) => (
              <select
                {...a11y}
                className="hf-input"
                value={form.sexoAlvo}
                onChange={(event) => alterarCampo('sexoAlvo', event.target.value)}
              >
                <option value="">Qualquer sexo</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
              </select>
            )}
          </Field>
        </div>

        <ConstrutorPerguntas
          perguntas={form.perguntas}
          erros={erros}
          onAlterar={alterarPergunta}
          onReordenar={reordenar}
          onAdicionar={adicionar}
        />
      </fieldset>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link to={voltarParaLista(form.tipo)} className="hf-button hf-button--secondary">
          {somenteLeitura ? 'Voltar' : 'Cancelar'}
        </Link>
        {!somenteLeitura && (
          <button type="submit" className="hf-button" disabled={salvando}>
            {salvando && 'Salvando…'}
            {!salvando && (editando ? 'Salvar alterações' : 'Criar modelo')}
          </button>
        )}
      </div>
    </form>
  );
}

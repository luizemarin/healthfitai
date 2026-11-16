import { useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import { errosDaApi, LIMITES, validarExercicio } from './exercicio-validacao';
import { exerciciosApi } from './exercicios-api';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { AsyncContent, useAsync } from '../../components/states';
import { avisarErro } from '../questionarios/avisar-erro';

import type { FormEvent, ReactElement } from 'react';

import type { CampoExercicio, ErrosExercicio, ExercicioForm } from './exercicio-validacao';
import type { Exercicio } from './exercicios-api';

const FORM_VAZIO: ExercicioForm = { nome: '', grupoMuscular: '', descricao: '', midiaUrl: '' };

function formDoExercicio(exercicio: Exercicio): ExercicioForm {
  return {
    nome: exercicio.nome,
    grupoMuscular: exercicio.grupoMuscular,
    descricao: exercicio.descricao ?? '',
    midiaUrl: exercicio.midiaUrl ?? '',
  };
}

/** FE-EXE-01 · Cadastro de exercício (/exercicios/novo). */
export function ExercicioNovoPage(): ReactElement {
  return (
    <>
      <h1>Cadastrar exercício</h1>
      <ExercicioFormulario inicial={FORM_VAZIO} />
    </>
  );
}

/** FE-EXE-01 · Edição de exercício (/exercicios/:id): carrega os dados e abre o mesmo formulário. */
export function ExercicioEditarPage(): ReactElement {
  const { id = '' } = useParams();
  const exercicio = useAsync(async (signal) => exerciciosApi.buscar(id, signal), [id]);

  return (
    <>
      <h1>Editar exercício</h1>
      <AsyncContent state={exercicio} loadingLabel="Carregando exercício…">
        {(dados) => <ExercicioFormulario exercicioId={dados.id} inicial={formDoExercicio(dados)} />}
      </AsyncContent>
    </>
  );
}

interface ExercicioFormularioProps {
  /** Sem id = cadastro; com id = edição. */
  exercicioId?: string;
  inicial: ExercicioForm;
}

/**
 * Formulário do exercício. Fluxo ao salvar:
 *   1. valida com as mesmas regras do back → erros aparecem embaixo de cada campo;
 *   2. envia → se o back recusar, a mensagem dele vai para o campo certo (ou para o aviso);
 *   3. deu certo → aviso de sucesso e volta para a biblioteca.
 */
function ExercicioFormulario({ exercicioId, inicial }: ExercicioFormularioProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ExercicioForm>(inicial);
  const [erros, setErros] = useState<ErrosExercicio>({});
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(exercicioId);
  const textoSalvar = editando ? 'Salvar alterações' : 'Cadastrar exercício';
  const tituloErro = editando ? 'Não foi possível salvar' : 'Não foi possível cadastrar';

  const alterar = (campo: CampoExercicio, valor: string): void => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    // Ao corrigir um campo, o erro dele some; os outros continuam visíveis.
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  /** Mostra os erros e leva o foco ao primeiro campo com problema. */
  const mostrarErros = (novos: ErrosExercicio): void => {
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      // Depois do render, para o aria-invalid já estar aplicado.
      setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${primeiro}`)?.focus());
    }
  };

  const salvar = async (): Promise<Exercicio> => {
    const descricao = form.descricao.trim();
    const midiaUrl = form.midiaUrl.trim();
    const base = { nome: form.nome.trim(), grupoMuscular: form.grupoMuscular.trim() };

    if (exercicioId) {
      // Na edição, campo opcional apagado = remove o valor (null).
      return exerciciosApi.editar(exercicioId, {
        ...base,
        descricao: descricao || null,
        midiaUrl: midiaUrl || null,
      });
    }
    return exerciciosApi.criar({
      ...base,
      ...(descricao && { descricao }),
      ...(midiaUrl && { midiaUrl }),
    });
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const errosLocais = validarExercicio(form);
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
      await salvar();
      toast.success(editando ? 'Exercício atualizado.' : 'Exercício cadastrado.');
      await navigate('/exercicios');
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        // Validação recusada pelo back: cada erro vai para o seu campo; o resto, para o aviso.
        const { porCampo, outros } = errosDaApi(error.details);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        if (error instanceof ApiError && error.code === 'EXERCICIO_DUPLICADO') {
          // O back explica: "Já existe um exercício chamado … na sua biblioteca."
          mostrarErros({ nome: error.message });
        }
        // Mensagem do back quando é para o usuário; senão, texto amigável (sem conexão, servidor…).
        avisarErro(toast, error, tituloErro);
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
      className="grid max-w-[640px] gap-md"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <p className="m-0 text-sm text-foreground-muted">
        Campos com <span className="text-danger">*</span> são obrigatórios.
      </p>

      <div className="grid gap-md md:grid-cols-2">
        <Field id="nome" label="Nome" required error={erros.nome}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: Agachamento livre"
              maxLength={LIMITES.nome}
              value={form.nome}
              onChange={(event) => alterar('nome', event.target.value)}
            />
          )}
        </Field>

        <Field id="grupoMuscular" label="Grupo muscular" required error={erros.grupoMuscular}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: Pernas"
              maxLength={LIMITES.grupoMuscular}
              value={form.grupoMuscular}
              onChange={(event) => alterar('grupoMuscular', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field id="descricao" label="Descrição" error={erros.descricao}>
        {(a11y) => (
          <textarea
            {...a11y}
            className="hf-input min-h-28"
            maxLength={LIMITES.descricao}
            value={form.descricao}
            onChange={(event) => alterar('descricao', event.target.value)}
          />
        )}
      </Field>

      <Field
        id="midiaUrl"
        label="Link de demonstração"
        hint="Vídeo ou imagem do exercício. Precisa começar com https://."
        error={erros.midiaUrl}
      >
        {(a11y) => (
          <input
            {...a11y}
            type="url"
            inputMode="url"
            autoComplete="off"
            className="hf-input"
            placeholder="https://"
            maxLength={LIMITES.midiaUrl}
            value={form.midiaUrl}
            onChange={(event) => alterar('midiaUrl', event.target.value)}
          />
        )}
      </Field>

      <div className="mt-sm flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link to="/exercicios" className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Salvando…' : textoSalvar}
        </button>
      </div>
    </form>
  );
}

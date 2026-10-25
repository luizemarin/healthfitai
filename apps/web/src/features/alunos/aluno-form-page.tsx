import { useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import { dataMinimaNascimento, errosDaApi, hoje, validarAluno } from './aluno-validacao';
import { alunosApi } from './alunos-api';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { AsyncContent, useAsync } from '../../components/states';

import type { FormEvent, ReactElement } from 'react';

import type { AlunoForm, CampoAluno, ErrosAluno } from './aluno-validacao';
import type { Aluno } from './alunos-api';

const FORM_VAZIO: AlunoForm = { nome: '', sexo: '', dataNascimento: '', email: '', telefone: '' };

function formDoAluno(aluno: Aluno): AlunoForm {
  return {
    nome: aluno.nome,
    sexo: aluno.sexo,
    dataNascimento: aluno.dataNascimento,
    email: aluno.email ?? '',
    telefone: aluno.telefone ?? '',
  };
}

/** FE-ALU-02 · Cadastro de aluno (/alunos/novo). */
export function AlunoNovoPage(): ReactElement {
  return (
    <>
      <h1>Cadastrar aluno</h1>
      <AlunoFormulario inicial={FORM_VAZIO} />
    </>
  );
}

/** FE-ALU-02 · Edição de aluno (/alunos/:id/editar): carrega os dados e abre o mesmo formulário. */
export function AlunoEditarPage(): ReactElement {
  const { id = '' } = useParams();
  const aluno = useAsync(async (signal) => alunosApi.buscar(id, signal), [id]);

  return (
    <>
      <h1>Editar aluno</h1>
      <AsyncContent state={aluno} loadingLabel="Carregando aluno…">
        {(dados) => <AlunoFormulario alunoId={dados.id} inicial={formDoAluno(dados)} />}
      </AsyncContent>
    </>
  );
}

interface AlunoFormularioProps {
  /** Sem id = cadastro; com id = edição. */
  alunoId?: string;
  inicial: AlunoForm;
}

/**
 * Formulário do aluno. Fluxo ao salvar:
 *   1. valida tudo com as mesmas regras do back → erros aparecem embaixo de cada campo;
 *   2. envia → se o back recusar, os erros dele vão para os campos (ou para o aviso);
 *   3. deu certo → aviso de sucesso e vai para a ficha do aluno.
 */
function AlunoFormulario({ alunoId, inicial }: AlunoFormularioProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<AlunoForm>(inicial);
  const [erros, setErros] = useState<ErrosAluno>({});
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(alunoId);
  const textoSalvar = editando ? 'Salvar alterações' : 'Cadastrar aluno';

  const alterar = (campo: CampoAluno, valor: string): void => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    // Ao corrigir um campo, o erro dele some; os outros continuam visíveis.
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  /** Mostra os erros e leva o foco ao primeiro campo com problema. */
  const mostrarErros = (novos: ErrosAluno): void => {
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      // Depois do render, para o aria-invalid já estar aplicado.
      setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${primeiro}`)?.focus());
    }
  };

  const salvar = async (): Promise<Aluno> => {
    const email = form.email.trim();
    const telefone = form.telefone.trim();
    const base = {
      nome: form.nome.trim(),
      sexo: form.sexo as Aluno['sexo'],
      dataNascimento: form.dataNascimento,
    };

    if (alunoId) {
      // Na edição, campo de contato apagado = remove o contato (null).
      return alunosApi.atualizar(alunoId, {
        ...base,
        email: email || null,
        telefone: telefone || null,
      });
    }
    return alunosApi.criar({
      ...base,
      ...(email && { email }),
      ...(telefone && { telefone }),
    });
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const errosLocais = validarAluno(form);
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
      const aluno = await salvar();
      toast.success(editando ? 'Dados do aluno atualizados.' : 'Aluno cadastrado.');
      await navigate(`/alunos/${aluno.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        // Validação recusada pelo back: cada erro vai para o seu campo; o resto, para o aviso.
        const { porCampo, outros } = errosDaApi(error.details);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        // Ex.: e-mail já usado por outro aluno (409), sem conexão, servidor fora.
        toast.fromError(error, editando ? 'Não foi possível salvar' : 'Não foi possível cadastrar');
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

      <Field id="nome" label="Nome" required error={erros.nome}>
        {(a11y) => (
          <input
            {...a11y}
            className="hf-input"
            autoComplete="off"
            maxLength={120}
            value={form.nome}
            onChange={(event) => alterar('nome', event.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-md md:grid-cols-2">
        <Field
          id="sexo"
          label="Sexo"
          required
          hint="Define o modelo de anamnese que o aluno recebe."
          error={erros.sexo}
        >
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={form.sexo}
              onChange={(event) => alterar('sexo', event.target.value)}
            >
              <option value="">Selecione</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          )}
        </Field>

        <Field id="dataNascimento" label="Data de nascimento" required error={erros.dataNascimento}>
          {(a11y) => (
            <input
              {...a11y}
              type="date"
              className="hf-input"
              min={dataMinimaNascimento()}
              max={hoje()}
              value={form.dataNascimento}
              onChange={(event) => alterar('dataNascimento', event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-md md:grid-cols-2">
        <Field id="email" label="E-mail" error={erros.email}>
          {(a11y) => (
            <input
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="off"
              className="hf-input"
              placeholder="aluno@email.com"
              maxLength={254}
              value={form.email}
              onChange={(event) => alterar('email', event.target.value)}
            />
          )}
        </Field>

        <Field id="telefone" label="Telefone" hint="DDD + número." error={erros.telefone}>
          {(a11y) => (
            <input
              {...a11y}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="hf-input"
              placeholder="(11) 98765-4321"
              maxLength={20}
              value={form.telefone}
              onChange={(event) => alterar('telefone', event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="mt-sm flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link
          to={alunoId ? `/alunos/${alunoId}` : '/alunos'}
          className="hf-button hf-button--secondary"
        >
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Salvando…' : textoSalvar}
        </button>
      </div>
    </form>
  );
}

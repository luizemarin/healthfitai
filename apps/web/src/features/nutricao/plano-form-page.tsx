import { useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import { nutricaoApi } from './nutricao-api';
import {
  caminhoRefeicao,
  errosDaApi,
  formDoPlano,
  formVazio,
  idDoCampo,
  LIMITES,
  novaRefeicao,
  paraEnvio,
  validarPlano,
} from './plano-validacao';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { ErrorState, LoadingState, useAsync } from '../../components/states';
import { alunosApi } from '../alunos/alunos-api';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement, ReactNode } from 'react';

import type { CampoRefeicao, ErrosPlano, PlanoForm, RefeicaoForm } from './plano-validacao';

/** FE-NUT-01 · Criar plano nutricional (/alunos/:id/nutricao/novo). */
export function PlanoNovoPage(): ReactElement {
  const { id = '' } = useParams();
  const dados = useAsync(
    async (signal) => {
      const [aluno, ativo] = await Promise.all([
        alunosApi.buscar(id, signal),
        nutricaoApi.buscarAtivo(id, signal),
      ]);
      return { aluno, ativo };
    },
    [id],
  );

  return (
    <Moldura
      alunoId={id}
      titulo="Novo plano nutricional"
      nomeAluno={dados.status === 'success' ? dados.data.aluno.nome : undefined}
    >
      {dados.status === 'loading' && <LoadingState label="Carregando…" />}
      {dados.status === 'error' && (
        <ErrorState
          error={dados.error}
          title="Não conseguimos abrir o plano nutricional"
          message={mensagemDaApi(dados.error)}
          onRetry={dados.reload}
        />
      )}
      {dados.status === 'success' && (
        <>
          {dados.data.ativo && (
            // Regra do back (BE-NUT-01): criar um plano substitui o que está em uso.
            <p className="mb-lg rounded-md border border-border bg-surface p-md">
              Ao salvar, este passa a ser o plano em uso e “{dados.data.ativo.nome}” vai para o
              histórico.
            </p>
          )}
          <PlanoFormulario alunoId={id} inicial={formVazio()} />
        </>
      )}
    </Moldura>
  );
}

/** FE-NUT-01 · Editar o plano em uso (/alunos/:id/nutricao/:planoId): carrega e abre o mesmo formulário. */
export function PlanoEditarPage(): ReactElement {
  const { id = '', planoId = '' } = useParams();
  const dados = useAsync(
    async (signal) => {
      const [aluno, plano] = await Promise.all([
        alunosApi.buscar(id, signal),
        nutricaoApi.buscar(planoId, signal),
      ]);
      return { aluno, plano };
    },
    [id, planoId],
  );

  return (
    <Moldura
      alunoId={id}
      titulo="Editar plano nutricional"
      nomeAluno={dados.status === 'success' ? dados.data.aluno.nome : undefined}
    >
      {dados.status === 'loading' && <LoadingState label="Carregando plano…" />}
      {dados.status === 'error' && (
        <ErrorState
          error={dados.error}
          title="Não conseguimos abrir o plano nutricional"
          message={mensagemDaApi(dados.error)}
          onRetry={dados.reload}
        />
      )}
      {dados.status === 'success' && (
        <PlanoFormulario
          alunoId={id}
          planoId={dados.data.plano.id}
          inicial={formDoPlano(dados.data.plano)}
        />
      )}
    </Moldura>
  );
}

/** Link de volta, título e nome do aluno: iguais nas duas páginas. */
function Moldura({
  alunoId,
  titulo,
  nomeAluno,
  children,
}: {
  alunoId: string;
  titulo: string;
  nomeAluno: string | undefined;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <Link
        to={`/alunos/${alunoId}?aba=nutricao`}
        className="mb-md inline-flex min-h-11 items-center text-foreground-muted"
      >
        ← Ficha do aluno
      </Link>
      <h1>{titulo}</h1>
      {nomeAluno && <p className="-mt-xs mb-lg text-foreground-muted">{nomeAluno}</p>}
      {children}
    </>
  );
}

interface PlanoFormularioProps {
  alunoId: string;
  /** Sem id = criar; com id = editar. */
  planoId?: string;
  inicial: PlanoForm;
}

/**
 * Formulário do plano: nome, observações e refeições na ordem do dia. Fluxo ao salvar:
 *   1. valida com as mesmas regras do back → erros aparecem embaixo de cada campo;
 *   2. envia → se o back recusar, a mensagem dele vai para o campo certo (ou para o aviso);
 *   3. deu certo → aviso de sucesso e volta para a aba Nutrição da ficha.
 */
function PlanoFormulario({ alunoId, planoId, inicial }: PlanoFormularioProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<PlanoForm>(inicial);
  const [erros, setErros] = useState<ErrosPlano>({});
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(planoId);
  const voltar = `/alunos/${alunoId}?aba=nutricao`;

  /** Mostra os erros e leva o foco ao primeiro campo com problema. */
  const mostrarErros = (novos: ErrosPlano): void => {
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      // Depois do render, para o aria-invalid já estar aplicado.
      setTimeout(() => document.getElementById(idDoCampo(primeiro))?.focus());
    }
  };

  const alterar = (campo: 'nome' | 'observacoes', valor: string): void => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const alterarRefeicao = (indice: number, campo: CampoRefeicao, valor: string): void => {
    setForm((atual) => ({
      ...atual,
      refeicoes: atual.refeicoes.map((item, posicao) =>
        posicao === indice ? { ...item, [campo]: valor } : item,
      ),
    }));
    const caminho = caminhoRefeicao(indice, campo);
    if (erros[caminho]) setErros((atual) => ({ ...atual, [caminho]: undefined }));
  };

  /** Adicionar, remover ou mudar a ordem muda as posições: os erros das refeições somem. */
  const trocarRefeicoes = (refeicoes: RefeicaoForm[]): void => {
    setForm((atual) => ({ ...atual, refeicoes }));
    setErros((atual) => ({ nome: atual['nome'], observacoes: atual['observacoes'] }));
  };

  const adicionar = (): void => {
    trocarRefeicoes([...form.refeicoes, novaRefeicao()]);
  };

  const mover = (indice: number, passo: -1 | 1): void => {
    const refeicoes = [...form.refeicoes];
    const [item] = refeicoes.splice(indice, 1);
    if (!item) return;
    refeicoes.splice(indice + passo, 0, item);
    trocarRefeicoes(refeicoes);
  };

  const remover = (indice: number): void => {
    trocarRefeicoes(form.refeicoes.filter((_, posicao) => posicao !== indice));
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const errosLocais = validarPlano(form);
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
      const body = paraEnvio(form);
      if (planoId) {
        await nutricaoApi.editar(planoId, body);
      } else {
        await nutricaoApi.criar(alunoId, body);
      }
      toast.success(editando ? 'Plano atualizado.' : 'Plano criado.');
      await navigate(voltar);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        // Recusado pelo back: cada erro vai para o seu campo; o resto, para o aviso.
        const { porCampo, outros } = errosDaApi(error.details);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        // Ex.: aluno inativo ou plano que já não está em uso — a mensagem do back explica;
        // sem conexão/servidor fora, texto amigável.
        avisarErro(toast, error, editando ? 'Não foi possível salvar' : 'Não foi possível criar');
      }
    } finally {
      setSalvando(false);
    }
  };

  const cheio = form.refeicoes.length >= LIMITES.refeicoes;

  return (
    <form
      // noValidate: a validação é nossa (mesmas regras do back), não a do navegador.
      noValidate
      className="grid gap-lg"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <p className="m-0 text-sm text-foreground-muted">
        Campos com <span className="text-danger">*</span> são obrigatórios.
      </p>

      <div className="grid max-w-[640px] gap-md">
        <Field id="nome" label="Nome do plano" required error={erros['nome']}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: Plano cutting · nov/26"
              maxLength={LIMITES.nome}
              value={form.nome}
              onChange={(event) => alterar('nome', event.target.value)}
            />
          )}
        </Field>

        <Field id="observacoes" label="Observações" error={erros['observacoes']}>
          {(a11y) => (
            <textarea
              {...a11y}
              className="hf-input min-h-28"
              placeholder="Ex.: Beber 3 L de água por dia."
              maxLength={LIMITES.observacoes}
              value={form.observacoes}
              onChange={(event) => alterar('observacoes', event.target.value)}
            />
          )}
        </Field>
      </div>

      <section aria-labelledby="refeicoes-titulo" className="grid min-w-0 gap-md">
        <div className="flex flex-wrap items-baseline justify-between gap-sm">
          <h2 id="refeicoes-titulo" className="m-0">
            Refeições
          </h2>
          <span className="text-sm text-foreground-muted tabular-nums">
            {form.refeicoes.length} de {LIMITES.refeicoes}
          </span>
        </div>

        {erros['refeicoes'] && (
          <p id="refeicoes" tabIndex={-1} className="m-0 text-sm text-danger">
            {erros['refeicoes']}
          </p>
        )}

        {form.refeicoes.length === 0 ? (
          <p className="m-0 rounded-md border border-dashed border-border p-md text-foreground-muted">
            Nenhuma refeição ainda. Adicione na ordem do dia.
          </p>
        ) : (
          <ol className="m-0 grid list-none gap-md p-0">
            {form.refeicoes.map((item, indice) => (
              <li key={item.chave}>
                <RefeicaoCard
                  item={item}
                  indice={indice}
                  total={form.refeicoes.length}
                  erros={erros}
                  onAlterar={(campo, valor) => alterarRefeicao(indice, campo, valor)}
                  onSubir={() => mover(indice, -1)}
                  onDescer={() => mover(indice, 1)}
                  onRemover={() => remover(indice)}
                />
              </li>
            ))}
          </ol>
        )}

        <div>
          <button
            type="button"
            className="hf-button hf-button--secondary"
            disabled={cheio}
            onClick={adicionar}
          >
            Adicionar refeição
          </button>
          {cheio && (
            <p className="m-0 mt-xs text-sm text-foreground-muted">
              O plano pode ter no máximo {LIMITES.refeicoes} refeições.
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link to={voltar} className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar plano'}
        </button>
      </div>
    </form>
  );
}

interface RefeicaoCardProps {
  item: RefeicaoForm;
  indice: number;
  total: number;
  erros: ErrosPlano;
  onAlterar: (campo: CampoRefeicao, valor: string) => void;
  onSubir: () => void;
  onDescer: () => void;
  onRemover: () => void;
}

/** Uma refeição do plano: ordem (↑ ↓), remover, nome, horário e descrição. */
function RefeicaoCard({
  item,
  indice,
  total,
  erros,
  onAlterar,
  onSubir,
  onDescer,
  onRemover,
}: RefeicaoCardProps): ReactElement {
  const numero = indice + 1;
  const nome = item.refeicao.trim() || `refeição ${String(numero)}`;
  const id = (campo: CampoRefeicao): string => idDoCampo(caminhoRefeicao(indice, campo));
  const erro = (campo: CampoRefeicao): string | undefined => erros[caminhoRefeicao(indice, campo)];

  return (
    <fieldset className="m-0 grid min-w-0 gap-md rounded-md border border-border bg-surface p-md">
      <legend className="sr-only">Refeição {numero}</legend>

      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-heading text-foreground-muted tabular-nums">{numero}.</span>
        <div className="flex gap-xs">
          <button
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover ${nome} para cima`}
            disabled={indice === 0}
            onClick={onSubir}
          >
            ↑
          </button>
          <button
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover ${nome} para baixo`}
            disabled={indice === total - 1}
            onClick={onDescer}
          >
            ↓
          </button>
          <button
            type="button"
            className="hf-button hf-button--danger"
            aria-label={`Remover ${nome} do plano`}
            onClick={onRemover}
          >
            Remover
          </button>
        </div>
      </div>

      <div className="grid gap-md md:grid-cols-[minmax(0,1fr)_180px]">
        <Field id={id('refeicao')} label="Refeição" required error={erro('refeicao')}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: Café da manhã"
              maxLength={LIMITES.refeicao}
              value={item.refeicao}
              onChange={(event) => onAlterar('refeicao', event.target.value)}
            />
          )}
        </Field>

        <Field
          id={id('horario')}
          label="Horário"
          hint="Vazio = sem horário."
          error={erro('horario')}
        >
          {(a11y) => (
            <input
              {...a11y}
              type="time"
              className="hf-input"
              value={item.horario}
              onChange={(event) => onAlterar('horario', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field
        id={id('descricao')}
        label="Alimentos e quantidades"
        required
        error={erro('descricao')}
      >
        {(a11y) => (
          <textarea
            {...a11y}
            className="hf-input min-h-28"
            placeholder="Ex.: 2 ovos mexidos, 1 pão integral e 1 fruta"
            maxLength={LIMITES.descricao}
            value={item.descricao}
            onChange={(event) => onAlterar('descricao', event.target.value)}
          />
        )}
      </Field>
    </fieldset>
  );
}

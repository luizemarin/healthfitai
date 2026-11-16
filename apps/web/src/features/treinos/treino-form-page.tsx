import { useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router';

import { SeletorExercicio } from './seletor-exercicio';
import {
  caminhoItem,
  errosDaApi,
  FORM_VAZIO,
  formDoTreino,
  idDoCampo,
  LIMITES,
  novoItem,
  paraEnvio,
  validarTreino,
} from './treino-validacao';
import { treinosApi } from './treinos-api';
import { ApiError } from '../../api/api-error';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { ErrorState, LoadingState, useAsync } from '../../components/states';
import { alunosApi } from '../alunos/alunos-api';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement, ReactNode } from 'react';

import type { CampoItem, ErrosTreino, ItemForm, TreinoForm } from './treino-validacao';
import type { ExercicioResumo } from './treinos-api';

/** FE-TRE-01 · Montar treino (/alunos/:id/treinos/novo). */
export function TreinoNovoPage(): ReactElement {
  const { id = '' } = useParams();
  const aluno = useAsync(async (signal) => alunosApi.buscar(id, signal), [id]);

  return (
    <Moldura
      alunoId={id}
      titulo="Montar treino"
      nomeAluno={aluno.status === 'success' ? aluno.data.nome : undefined}
    >
      {aluno.status === 'loading' && <LoadingState label="Carregando…" />}
      {aluno.status === 'error' && (
        <ErrorState
          error={aluno.error}
          title="Não conseguimos abrir a montagem do treino"
          message={mensagemDaApi(aluno.error)}
          onRetry={aluno.reload}
        />
      )}
      {aluno.status === 'success' && <TreinoFormulario alunoId={id} inicial={FORM_VAZIO} />}
    </Moldura>
  );
}

/** FE-TRE-01 · Editar treino (/alunos/:id/treinos/:treinoId): carrega e abre o mesmo editor. */
export function TreinoEditarPage(): ReactElement {
  const { id = '', treinoId = '' } = useParams();
  const dados = useAsync(
    async (signal) => {
      const [aluno, treino] = await Promise.all([
        alunosApi.buscar(id, signal),
        treinosApi.buscar(treinoId, signal),
      ]);
      return { aluno, treino };
    },
    [id, treinoId],
  );

  return (
    <Moldura
      alunoId={id}
      titulo="Editar treino"
      nomeAluno={dados.status === 'success' ? dados.data.aluno.nome : undefined}
    >
      {dados.status === 'loading' && <LoadingState label="Carregando treino…" />}
      {dados.status === 'error' && (
        <ErrorState
          error={dados.error}
          title="Não conseguimos abrir o treino"
          message={mensagemDaApi(dados.error)}
          onRetry={dados.reload}
        />
      )}
      {dados.status === 'success' && (
        <TreinoFormulario
          alunoId={id}
          treinoId={dados.data.treino.id}
          inicial={formDoTreino(dados.data.treino)}
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
        to={`/alunos/${alunoId}?aba=treinos`}
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

interface TreinoFormularioProps {
  alunoId: string;
  /** Sem id = montar; com id = editar. */
  treinoId?: string;
  inicial: TreinoForm;
}

/**
 * Editor do treino: nome + exercícios na ordem em que serão feitos, cada um com séries,
 * repetições, descanso e carga. Fluxo ao salvar:
 *   1. valida com as mesmas regras do back → erros aparecem embaixo de cada campo;
 *   2. envia → se o back recusar, a mensagem dele vai para o campo certo (ou para o aviso);
 *   3. deu certo → aviso de sucesso e volta para a aba Treinos da ficha.
 */
function TreinoFormulario({ alunoId, treinoId, inicial }: TreinoFormularioProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<TreinoForm>(inicial);
  const [erros, setErros] = useState<ErrosTreino>({});
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(treinoId);
  const voltar = `/alunos/${alunoId}?aba=treinos`;

  /** Mostra os erros e leva o foco ao primeiro campo com problema. */
  const mostrarErros = (novos: ErrosTreino): void => {
    setErros(novos);
    const primeiro = Object.keys(novos)[0];
    if (primeiro) {
      // Depois do render, para o aria-invalid já estar aplicado.
      setTimeout(() => document.getElementById(idDoCampo(primeiro))?.focus());
    }
  };

  const alterarNome = (nome: string): void => {
    setForm((atual) => ({ ...atual, nome }));
    if (erros['nome']) setErros((atual) => ({ ...atual, nome: undefined }));
  };

  const alterarItem = (indice: number, campo: CampoItem, alteracao: Partial<ItemForm>): void => {
    setForm((atual) => ({
      ...atual,
      itens: atual.itens.map((item, posicao) =>
        posicao === indice ? { ...item, ...alteracao } : item,
      ),
    }));
    const caminho = caminhoItem(indice, campo);
    if (erros[caminho]) setErros((atual) => ({ ...atual, [caminho]: undefined }));
  };

  /** Adicionar, remover ou mudar a ordem muda as posições: os erros dos exercícios somem. */
  const trocarItens = (itens: ItemForm[]): void => {
    setForm((atual) => ({ ...atual, itens }));
    setErros((atual) => ({ nome: atual['nome'] }));
  };

  const adicionar = (exercicio: ExercicioResumo): void => {
    trocarItens([...form.itens, novoItem(exercicio)]);
  };

  const mover = (indice: number, passo: -1 | 1): void => {
    const itens = [...form.itens];
    const [item] = itens.splice(indice, 1);
    if (!item) return;
    itens.splice(indice + passo, 0, item);
    trocarItens(itens);
  };

  const remover = (indice: number): void => {
    trocarItens(form.itens.filter((_, posicao) => posicao !== indice));
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const errosLocais = validarTreino(form);
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
      if (treinoId) {
        await treinosApi.editar(treinoId, body);
      } else {
        await treinosApi.criar(alunoId, body);
      }
      toast.success(editando ? 'Treino atualizado.' : 'Treino montado.');
      await navigate(voltar);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        // Recusado pelo back: cada erro vai para o seu campo; o resto, para o aviso.
        const { porCampo, outros } = errosDaApi(error.details, error.code);
        mostrarErros(porCampo);
        toast.error('Verifique os campos destacados', error.message, outros);
      } else {
        // Ex.: aluno inativo — a mensagem do back explica; sem conexão/servidor fora, texto amigável.
        avisarErro(toast, error, editando ? 'Não foi possível salvar' : 'Não foi possível montar');
      }
    } finally {
      setSalvando(false);
    }
  };

  const jaAdicionados = new Set(form.itens.map((item) => item.exercicio.id));

  return (
    <form
      ref={formRef}
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

      <div className="max-w-[640px]">
        <Field id="nome" label="Nome do treino" required error={erros['nome']}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: Treino A · Pernas"
              maxLength={LIMITES.nome}
              value={form.nome}
              onChange={(event) => alterarNome(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section aria-labelledby="exercicios-titulo" className="grid min-w-0 gap-md">
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <h2 id="exercicios-titulo" className="m-0">
              Exercícios
            </h2>
            <span className="text-sm text-foreground-muted tabular-nums">
              {form.itens.length} de {LIMITES.exercicios}
            </span>
          </div>

          {erros['exercicios'] && (
            <p id="exercicios" tabIndex={-1} className="m-0 text-sm text-danger">
              {erros['exercicios']}
            </p>
          )}

          {form.itens.length === 0 ? (
            <p className="m-0 rounded-md border border-dashed border-border p-md text-foreground-muted">
              Nenhum exercício ainda. Busque na biblioteca e adicione na ordem em que o aluno vai
              fazer.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-md p-0">
              {form.itens.map((item, indice) => (
                <li key={item.chave}>
                  <ItemCard
                    item={item}
                    indice={indice}
                    total={form.itens.length}
                    erros={erros}
                    onAlterar={(campo, alteracao) => alterarItem(indice, campo, alteracao)}
                    onSubir={() => mover(indice, -1)}
                    onDescer={() => mover(indice, 1)}
                    onRemover={() => remover(indice)}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        <SeletorExercicio
          jaAdicionados={jaAdicionados}
          cheio={form.itens.length >= LIMITES.exercicios}
          onAdicionar={adicionar}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Link to={voltar} className="hf-button hf-button--secondary">
          Cancelar
        </Link>
        <button type="submit" className="hf-button" disabled={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar treino'}
        </button>
      </div>
    </form>
  );
}

interface ItemCardProps {
  item: ItemForm;
  indice: number;
  total: number;
  erros: ErrosTreino;
  onAlterar: (campo: CampoItem, alteracao: Partial<ItemForm>) => void;
  onSubir: () => void;
  onDescer: () => void;
  onRemover: () => void;
}

/** Um exercício do treino: ordem (↑ ↓), remover, séries, repetições, descanso e carga. */
function ItemCard({
  item,
  indice,
  total,
  erros,
  onAlterar,
  onSubir,
  onDescer,
  onRemover,
}: ItemCardProps): ReactElement {
  const numero = indice + 1;
  const id = (campo: CampoItem): string => idDoCampo(caminhoItem(indice, campo));
  const erro = (campo: CampoItem): string | undefined => erros[caminhoItem(indice, campo)];
  const erroExercicio = erro('exercicioId');

  return (
    <fieldset className="m-0 grid min-w-0 gap-md rounded-md border border-border bg-surface p-md">
      <legend className="sr-only">
        Exercício {numero}: {item.exercicio.nome}
      </legend>

      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="flex flex-wrap items-center gap-sm">
            <span className="font-heading text-foreground-muted tabular-nums">{numero}.</span>
            <span className="font-heading font-semibold">{item.exercicio.nome}</span>
            {!item.exercicio.ativo && (
              <span className="hf-badge border-danger text-danger">Excluído da biblioteca</span>
            )}
          </span>
          <span className="text-sm text-foreground-muted">{item.exercicio.grupoMuscular}</span>
        </div>
        <div className="flex gap-xs">
          <button
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover ${item.exercicio.nome} para cima`}
            disabled={indice === 0}
            onClick={onSubir}
          >
            ↑
          </button>
          <button
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover ${item.exercicio.nome} para baixo`}
            disabled={indice === total - 1}
            onClick={onDescer}
          >
            ↓
          </button>
          <button
            type="button"
            className="hf-button hf-button--danger"
            aria-label={`Remover ${item.exercicio.nome} do treino`}
            onClick={onRemover}
          >
            Remover
          </button>
        </div>
      </div>

      {erroExercicio && (
        <p id={id('exercicioId')} tabIndex={-1} className="m-0 text-sm text-danger">
          {erroExercicio}
        </p>
      )}

      <div className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
        <Field id={id('series')} label="Séries" required error={erro('series')}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 4"
              value={item.series}
              onChange={(event) => onAlterar('series', { series: event.target.value })}
            />
          )}
        </Field>

        <Field id={id('repeticoes')} label="Repetições" required error={erro('repeticoes')}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              placeholder="Ex.: 8-12"
              maxLength={LIMITES.repeticoes}
              value={item.repeticoes}
              onChange={(event) => onAlterar('repeticoes', { repeticoes: event.target.value })}
            />
          )}
        </Field>

        <Field
          id={id('descansoSegundos')}
          label="Descanso (segundos)"
          required
          error={erro('descansoSegundos')}
        >
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 90"
              value={item.descanso}
              onChange={(event) => onAlterar('descansoSegundos', { descanso: event.target.value })}
            />
          )}
        </Field>

        <Field
          id={id('cargaKg')}
          label="Carga (kg)"
          hint="Vazio = sem carga."
          error={erro('cargaKg')}
        >
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ex.: 40"
              value={item.carga}
              onChange={(event) => onAlterar('cargaKg', { carga: event.target.value })}
            />
          )}
        </Field>
      </div>
    </fieldset>
  );
}

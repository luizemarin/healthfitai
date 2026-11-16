import { useState } from 'react';

import { fotosApi } from './fotos-api';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { avisarErro } from '../questionarios/avisar-erro';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { FormEvent, ReactElement } from 'react';

import type { Pose } from './fotos-api';

/** Mesmo limite do back (fotos.schemas.ts → nomePose). */
const MAX_NOME_POSE = 60;

/** Mesmas regras do back: obrigatório e até 60 caracteres (sem contar espaços nas pontas). */
function validarNome(nome: string): string | undefined {
  if (!nome.trim()) return 'O nome da pose é obrigatório.';
  if (nome.trim().length > MAX_NOME_POSE) {
    return `O nome da pose deve ter no máximo ${MAX_NOME_POSE} caracteres.`;
  }
  return undefined;
}

/**
 * FE-FOT-01 · Configurar poses: as poses que o app pede ao aluno, na ordem.
 * Padrão frente, perfil e costas (o back cria na primeira vez); adicionar e remover.
 * Remover não apaga nada: a pose some do app e as fotos já tiradas continuam guardadas.
 */
export function PosesPage(): ReactElement {
  const poses = useAsync(async (signal) => fotosApi.poses(signal), []);
  const toast = useToast();

  const [nome, setNome] = useState('');
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<Pose | null>(null);

  const adicionar = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const erro = validarNome(nome);
    setErroNome(erro);
    if (erro) return;

    setSalvando(true);
    try {
      const pose = await fotosApi.adicionarPose(nome.trim());
      toast.success('Pose adicionada.', `"${pose.nome}" entrou no fim da lista.`);
      setNome('');
      poses.reload();
    } catch (error) {
      // Nome repetido ou limite de poses: o back explica o motivo.
      avisarErro(toast, error, 'Não foi possível adicionar a pose');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (pose: Pose): Promise<void> => {
    setSalvando(true);
    try {
      await fotosApi.removerPose(pose.id);
      toast.success('Pose removida.', 'As fotos já tiradas nela continuam guardadas.');
      poses.reload();
    } catch (error) {
      // Ex.: última pose ativa (precisa sobrar pelo menos uma).
      avisarErro(toast, error, 'Não foi possível remover a pose');
    } finally {
      setSalvando(false);
      setRemovendo(null);
    }
  };

  let lista: ReactElement;
  if (poses.status === 'loading') {
    lista = <LoadingState label="Carregando poses…" />;
  } else if (poses.status === 'error') {
    lista = (
      <ErrorState
        error={poses.error}
        title="Não conseguimos carregar as poses"
        message={mensagemDaApi(poses.error)}
        onRetry={poses.reload}
      />
    );
  } else if (poses.data.length === 0) {
    lista = (
      <EmptyState
        title="Nenhuma pose ativa"
        description="Adicione uma pose para o aluno saber quais fotos enviar."
      />
    );
  } else {
    lista = (
      <ol className="m-0 grid list-none gap-sm p-0">
        {poses.data.map((pose, indice) => (
          <li
            key={pose.id}
            className="flex items-center justify-between gap-md rounded-md border border-border bg-surface p-md"
          >
            <span className="flex items-center gap-sm">
              <span className="font-heading text-foreground-muted tabular-nums">{indice + 1}.</span>
              <span className="font-semibold">{pose.nome}</span>
            </span>
            <button
              type="button"
              className="hf-button hf-button--danger"
              disabled={salvando}
              onClick={() => setRemovendo(pose)}
            >
              Remover
            </button>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <>
      <h1 className="mb-xs">Poses das fotos</h1>
      <p className="m-0 mb-lg text-foreground-muted">
        O app pede ao aluno uma foto de cada pose, nesta ordem.
      </p>

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section aria-label="Poses ativas">{lista}</section>

        <form
          noValidate
          className="grid gap-md rounded-md border border-border bg-surface p-md"
          onSubmit={(event) => void adicionar(event)}
        >
          <h2 className="m-0 text-lg">Adicionar pose</h2>
          <Field id="nome-pose" label="Nome da pose" required error={erroNome}>
            {(a11y) => (
              <input
                {...a11y}
                className="hf-input"
                placeholder="Ex.: Lateral direita"
                maxLength={MAX_NOME_POSE}
                value={nome}
                onChange={(event) => setNome(event.target.value)}
              />
            )}
          </Field>
          <button type="submit" className="hf-button" disabled={salvando}>
            Adicionar
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={removendo !== null}
        title={`Remover a pose "${removendo?.nome ?? ''}"?`}
        message="O app deixa de pedir esta pose. Nada é apagado: as fotos já tiradas nela continuam guardadas."
        confirmLabel="Remover"
        danger
        busy={salvando}
        onConfirm={() => {
          if (removendo) void remover(removendo);
        }}
        onCancel={() => setRemovendo(null)}
      />
    </>
  );
}

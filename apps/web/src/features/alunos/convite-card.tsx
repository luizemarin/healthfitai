import { useState } from 'react';

import { formatarDataHora } from './aluno-formato';
import { convitesApi } from './alunos-api';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { AsyncContent, useAsync } from '../../components/states';

import type { ReactElement } from 'react';

import type { Convite, ConviteGerado } from './alunos-api';

type Acao = 'gerar' | 'reenviar' | 'revogar';

/** Como cada situação do último convite aparece para o profissional. */
function descreverConvite(convite: Convite | undefined): string {
  if (!convite) return 'Nenhum convite gerado ainda.';
  switch (convite.status) {
    case 'valido':
      return `Convite válido até ${formatarDataHora(convite.expiraEm)}.`;
    case 'usado':
      return `O aluno ativou o acesso em ${formatarDataHora(convite.usadoEm ?? convite.criadoEm)}.`;
    case 'revogado':
      return `Último convite revogado em ${formatarDataHora(convite.revogadoEm ?? convite.criadoEm)}.`;
    case 'expirado':
      return `Último convite expirou em ${formatarDataHora(convite.expiraEm)}.`;
    default:
      return '';
  }
}

const CONFIRMACOES = {
  reenviar: {
    title: 'Gerar um novo link?',
    message: 'O link atual deixa de funcionar e um novo é gerado para você enviar ao aluno.',
    confirmLabel: 'Gerar novo link',
    danger: false,
  },
  revogar: {
    title: 'Revogar o convite?',
    message: 'O link atual deixa de funcionar. Você pode gerar outro quando quiser.',
    confirmLabel: 'Revogar convite',
    danger: true,
  },
} as const;

interface ConviteCardProps {
  alunoId: string;
  alunoAtivo: boolean;
}

/**
 * FE-ALU-03 · Convite por link único, na ficha do aluno: gerar, copiar, reenviar e revogar.
 * Por segurança o back só devolve o link ao gerar/reenviar: ele aparece aqui uma vez para copiar.
 */
export function ConviteCard({ alunoId, alunoAtivo }: ConviteCardProps): ReactElement {
  const toast = useToast();
  const convites = useAsync(async (signal) => convitesApi.listar(alunoId, signal), [alunoId]);
  const [gerado, setGerado] = useState<ConviteGerado | null>(null);
  const [confirmar, setConfirmar] = useState<'reenviar' | 'revogar' | null>(null);
  const [executando, setExecutando] = useState<Acao | null>(null);

  const executar = async (acao: Acao): Promise<void> => {
    setExecutando(acao);
    try {
      if (acao === 'revogar') {
        await convitesApi.revogar(alunoId);
        setGerado(null);
        toast.success('Convite revogado.', 'O link anterior não funciona mais.');
      } else {
        const novo =
          acao === 'gerar' ? await convitesApi.gerar(alunoId) : await convitesApi.reenviar(alunoId);
        setGerado(novo);
        toast.success('Link de convite gerado.', 'Copie e envie ao aluno.');
      }
    } catch (error) {
      toast.fromError(error, 'Não foi possível concluir a ação do convite');
    } finally {
      setExecutando(null);
      setConfirmar(null);
      convites.reload();
    }
  };

  const copiar = async (link: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error(
        'Não foi possível copiar',
        'Selecione o link e copie manualmente (Ctrl+C / ⌘+C).',
      );
    }
  };

  const dialogo = confirmar ? CONFIRMACOES[confirmar] : null;

  return (
    <section
      aria-labelledby="convite-titulo"
      className="rounded-md border border-border bg-surface p-md"
    >
      <h2 id="convite-titulo" className="text-lg md:text-lg">
        Convite de acesso
      </h2>

      <AsyncContent state={convites} loadingLabel="Carregando convite…">
        {({ data }) => {
          const ultimo = data[0];
          const temValido = ultimo?.status === 'valido';

          return (
            <div className="grid gap-md">
              <p className="m-0 text-foreground-muted">{descreverConvite(ultimo)}</p>

              {gerado && (
                <Field
                  id="link-convite"
                  label="Link do convite"
                  hint="Por segurança, o link só aparece agora. Se perder, gere um novo."
                >
                  {(a11y) => (
                    <div className="flex flex-col gap-sm md:flex-row">
                      <input
                        {...a11y}
                        className="hf-input font-mono text-sm"
                        readOnly
                        value={gerado.link}
                        onFocus={(event) => event.target.select()}
                      />
                      <button
                        type="button"
                        className="hf-button shrink-0"
                        onClick={() => void copiar(gerado.link)}
                      >
                        Copiar link
                      </button>
                    </div>
                  )}
                </Field>
              )}

              {alunoAtivo ? (
                <div className="flex flex-col gap-3 md:flex-row">
                  {!temValido && (
                    <button
                      type="button"
                      className="hf-button"
                      disabled={executando !== null}
                      onClick={() => void executar('gerar')}
                    >
                      {executando === 'gerar' ? 'Gerando…' : 'Gerar convite'}
                    </button>
                  )}
                  {temValido && (
                    <>
                      <button
                        type="button"
                        className="hf-button hf-button--secondary"
                        disabled={executando !== null}
                        onClick={() => setConfirmar('reenviar')}
                      >
                        Reenviar (novo link)
                      </button>
                      <button
                        type="button"
                        className="hf-button hf-button--danger"
                        disabled={executando !== null}
                        onClick={() => setConfirmar('revogar')}
                      >
                        Revogar convite
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="m-0 text-sm text-foreground-muted">
                  O aluno está inativo. Ative o aluno para gerar um convite.
                </p>
              )}
            </div>
          );
        }}
      </AsyncContent>

      {dialogo && confirmar && (
        <ConfirmDialog
          open
          title={dialogo.title}
          message={dialogo.message}
          confirmLabel={dialogo.confirmLabel}
          danger={dialogo.danger}
          busy={executando !== null}
          onConfirm={() => void executar(confirmar)}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}

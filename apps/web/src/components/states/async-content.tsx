import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

import type { ReactNode } from 'react';

import type { AsyncResult } from './use-async';

interface AsyncContentProps<T> {
  /** Retorno do useAsync. */
  state: AsyncResult<T>;
  /** Conteúdo quando há dados. */
  children: (data: T) => ReactNode;
  /** Diz se os dados estão vazios (ex.: lista sem itens). */
  isEmpty?: ((data: T) => boolean) | undefined;
  /** O que mostrar quando vazio. Padrão: mensagem genérica. */
  empty?: ReactNode;
  /** Texto do carregando (ex.: "Carregando alunos…"). */
  loadingLabel?: string | undefined;
}

/**
 * Padrão de toda tela que carrega dados: escolhe sozinho entre carregando, erro, vazio e conteúdo.
 *
 *   <AsyncContent
 *     state={alunos}
 *     isEmpty={(page) => page.items.length === 0}
 *     empty={<EmptyState title="Nenhum aluno cadastrado" />}
 *   >
 *     {(page) => <ListaDeAlunos alunos={page.items} />}
 *   </AsyncContent>
 */
export function AsyncContent<T>({
  state,
  children,
  isEmpty,
  empty,
  loadingLabel,
}: AsyncContentProps<T>): ReactNode {
  if (state.status === 'loading') {
    return <LoadingState label={loadingLabel} />;
  }

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  if (isEmpty?.(state.data)) {
    return empty ?? <EmptyState title="Nada por aqui ainda" />;
  }

  return children(state.data);
}

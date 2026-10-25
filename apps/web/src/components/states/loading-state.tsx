import { stateClasses } from './state-classes';

import type { ReactElement } from 'react';

interface LoadingStateProps {
  /** Ex.: "Carregando alunos…". */
  label?: string | undefined;
}

/**
 * Estado "carregando". Só aparece depois de 300ms, para respostas rápidas
 * não piscarem um spinner na tela.
 */
export function LoadingState({ label = 'Carregando…' }: LoadingStateProps): ReactElement {
  return (
    <div
      className={`${stateClasses.root} animate-fade-in-delayed motion-reduce:animate-none`}
      role="status"
      aria-live="polite"
    >
      <span
        className="size-8 animate-spin rounded-full border-[3px] border-border border-t-foreground motion-reduce:animate-spin-slow"
        aria-hidden="true"
      />
      <p className={stateClasses.message}>{label}</p>
    </div>
  );
}

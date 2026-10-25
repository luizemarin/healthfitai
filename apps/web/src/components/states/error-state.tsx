import { describeError } from './describe-error';
import { stateClasses } from './state-classes';

import type { ReactElement, ReactNode } from 'react';

interface ErrorStateProps {
  /** O erro capturado; vira título e mensagem amigáveis via describeError. */
  error?: unknown;
  /** Sobrescreve o título gerado. */
  title?: string | undefined;
  /** Sobrescreve a mensagem gerada. */
  message?: string | undefined;
  /** Mostra "Tentar novamente" (quando o erro permite). */
  onRetry?: (() => void) | undefined;
  /** Ação extra (ex.: link "Voltar ao início"). */
  action?: ReactNode;
}

/** Estado "erro": mensagem amigável + o que a pessoa pode fazer. Nunca mostra detalhe técnico. */
export function ErrorState({
  error,
  title,
  message,
  onRetry,
  action,
}: ErrorStateProps): ReactElement {
  const friendly = describeError(error);
  const showRetry = Boolean(onRetry) && friendly.canRetry;
  const hasActions = showRetry || Boolean(action);

  return (
    <div className={stateClasses.root} role="alert">
      <h2 className={stateClasses.title}>{title ?? friendly.title}</h2>
      <p className={stateClasses.message}>{message ?? friendly.message}</p>
      {hasActions && (
        <div className={stateClasses.actions}>
          {showRetry && (
            <button type="button" className="hf-button" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

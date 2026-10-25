import { stateClasses } from './state-classes';

import type { ReactElement, ReactNode } from 'react';

interface EmptyStateProps {
  /** Ex.: "Nenhum aluno cadastrado". */
  title: string;
  /** O que a pessoa pode fazer a seguir. */
  description?: string | undefined;
  /** Botão ou link da próxima ação (ex.: "Cadastrar aluno"). */
  action?: ReactNode;
}

/** Estado "vazio": carregou certo, mas não há nada para mostrar. */
export function EmptyState({ title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className={stateClasses.root}>
      <h2 className={stateClasses.title}>{title}</h2>
      {description && <p className={stateClasses.message}>{description}</p>}
      {action && <div className={stateClasses.actions}>{action}</div>}
    </div>
  );
}

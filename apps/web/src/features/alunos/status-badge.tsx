import type { ReactElement } from 'react';

/** Situação do aluno: Ativo (destaque) ou Inativo (apagado). */
export function StatusBadge({ ativo }: { ativo: boolean }): ReactElement {
  return ativo ? (
    <span className="hf-badge border-primary bg-primary text-primary-foreground">Ativo</span>
  ) : (
    <span className="hf-badge border-border text-foreground-muted">Inativo</span>
  );
}

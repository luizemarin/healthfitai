import { STATUS_LABEL } from './feedback-formato';

import type { ReactElement } from 'react';

import type { StatusFeedback } from './feedbacks-api';

/** Visual de cada status: o texto sempre aparece, a cor só reforça (funciona sem as cores). */
const CLASSES: Record<StatusFeedback, string> = {
  agendado: 'border-border text-foreground-muted',
  enviado: 'border-foreground text-foreground',
  respondido: 'border-primary bg-primary text-primary-foreground',
  atrasado: 'border-danger text-danger',
};

/** Status do feedback (BE-FBK-04): Agendado, Enviado, Respondido ou Atrasado. */
export function StatusFeedbackBadge({ status }: { status: StatusFeedback }): ReactElement {
  return <span className={`hf-badge ${CLASSES[status]}`}>{STATUS_LABEL[status]}</span>;
}

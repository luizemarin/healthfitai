import { Text, View } from 'react-native';

import { STATUS_LABEL } from './feedback-formato';

import type { ReactElement } from 'react';

import type { StatusFeedback } from './feedbacks-api';

/** Visual de cada status (mesmas cores do painel web): o texto sempre aparece, a cor só reforça. */
const CLASSES: Record<StatusFeedback, { caixa: string; texto: string }> = {
  agendado: { caixa: 'border-border', texto: 'text-foreground-muted' },
  enviado: { caixa: 'border-foreground', texto: 'text-foreground' },
  respondido: { caixa: 'border-primary bg-primary', texto: 'text-primary-foreground' },
  atrasado: { caixa: 'border-danger', texto: 'text-danger' },
};

/** Status do feedback: Pendente, Atrasado ou Respondido. */
export function StatusFeedbackBadge({ status }: { status: StatusFeedback }): ReactElement {
  const { caixa, texto } = CLASSES[status];
  return (
    <View className={`self-start rounded-pill border px-sm py-xs ${caixa}`}>
      <Text className={`font-body-strong text-xs ${texto}`}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

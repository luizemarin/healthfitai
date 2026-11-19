import { Text, View } from 'react-native';

import { segundosEntre, useAgora } from './relogio';
import { duracao } from './treinos-formato';

import type { ReactElement } from 'react';

interface TimerPillProps {
  /** Início do treino (ms). */
  inicio: number;
  /** Fim (ms) quando o treino foi finalizado: o tempo para. null = ainda correndo. */
  fim: number | null;
}

/**
 * MB-TRE-01 · Timer do treino em pill, no header. Atualiza sozinho (só ele redesenha a cada
 * segundo, não a tela inteira). Largura mínima fixa: o pill não "pula" quando os dígitos mudam.
 */
export function TimerPill({ inicio, fim }: TimerPillProps): ReactElement {
  const agora = useAgora(fim === null);
  const texto = duracao(segundosEntre(inicio, fim ?? agora));

  return (
    <View
      accessible
      accessibilityLabel={`Tempo de treino: ${texto}`}
      className="min-w-20 items-center rounded-pill bg-primary px-md py-xs"
    >
      <Text className="font-numeric text-md text-primary-foreground">{texto}</Text>
    </View>
  );
}

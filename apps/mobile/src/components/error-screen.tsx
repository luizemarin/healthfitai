import { Pressable, Text, View } from 'react-native';

import type { ReactElement } from 'react';

interface ErrorScreenProps {
  title?: string;
  message?: string;
  /** Ação do botão "Tentar novamente". Sem ela, o botão não aparece. */
  onRetry?: () => void;
}

/**
 * Tela amigável para quando algo não carrega (fontes, uma tela que quebrou ao renderizar).
 *
 * De propósito usa só a fonte do sistema (font-bold/font-semibold, sem font-heading/font-body) e
 * componentes nativos: ela precisa funcionar justamente quando o resto falhou. O detalhe técnico
 * vai para o console, nunca para o aluno.
 */
export function ErrorScreen({
  title = 'Não conseguimos carregar esta tela',
  message = 'Pode ter sido uma falha momentânea. Tente de novo em instantes.',
  onRetry,
}: ErrorScreenProps): ReactElement {
  return (
    <View accessibilityRole="alert" className="flex-1 justify-center gap-md bg-background p-lg">
      <Text className="text-xl font-bold text-foreground">{title}</Text>
      <Text className="text-md leading-relaxed text-foreground-muted">{message}</Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          className="mt-sm min-h-12 items-center justify-center rounded-md bg-primary active:opacity-70"
          onPress={onRetry}
        >
          <Text className="text-md font-semibold text-primary-foreground">Tentar novamente</Text>
        </Pressable>
      )}
    </View>
  );
}

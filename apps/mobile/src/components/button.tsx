import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '../theme/tokens';

import type { ReactElement } from 'react';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  /** `secondary`: só contorno, para ações menos importantes (ex.: Sair). */
  variant?: 'primary' | 'secondary';
}

const variants = {
  primary: { box: 'bg-primary', label: 'text-primary-foreground', spinner: colors.onPrimary },
  secondary: { box: 'border border-foreground', label: 'text-foreground', spinner: colors.text },
} as const;

/** Botão padrão do app. Com `loading`, mostra o indicador e não aceita toque. */
export function Button({
  label,
  onPress,
  loading = false,
  variant = 'primary',
}: ButtonProps): ReactElement {
  const style = variants[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      className={`min-h-12 items-center justify-center rounded-md px-lg active:opacity-70 ${style.box} ${loading ? 'opacity-70' : ''}`}
      disabled={loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={style.spinner} />
      ) : (
        <Text className={`font-body-strong text-md ${style.label}`}>{label}</Text>
      )}
    </Pressable>
  );
}

import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '../theme/tokens';

import type { ReactElement } from 'react';

export default function HomeScreen(): ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Área do aluno</Text>
      <Text style={styles.subtitle}>Seu acompanhamento começa aqui.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
});

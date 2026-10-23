import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '../theme/tokens';

import type { ReactElement } from 'react';

/** Rota inexistente (ex.: deep link antigo ou digitado errado). */
export default function NotFoundScreen(): ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tela não encontrada</Text>
      <Link href="/" style={styles.link}>
        Voltar ao início
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
  },
  link: {
    color: colors.text,
    fontFamily: fonts.bodyStrong,
    fontSize: fontSizes.md,
    textDecorationLine: 'underline',
  },
});

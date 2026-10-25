// @ts-expect-error -- nativewind/preset é CommonJS e não publica tipos.
import nativewindPreset from 'nativewind/preset';

import { colors, fonts, fontSizes, radius, spacing } from './src/theme/tokens';

import type { Config } from 'tailwindcss';

const px = (value: number): string => `${String(value)}px`;

const toPx = <K extends string>(scale: Record<K, number>): Record<K, string> =>
  Object.fromEntries(
    Object.entries<number>(scale).map(([key, value]) => [key, px(value)]),
  ) as Record<K, string>;

/**
 * Tema do Tailwind (NativeWind) gerado a partir de src/theme/tokens.ts: os tokens continuam sendo a
 * única fonte de valores. Cores, fontes, tamanhos de texto e raios SUBSTITUEM os do Tailwind, então
 * só existe o que é do design system (ex.: não há `bg-red-500`).
 *
 *   bg-background · bg-surface · border-border · bg-primary · text-primary-foreground
 *   text-foreground · text-foreground-muted · font-heading · text-xl · rounded-md · p-lg · gap-md
 */
export default {
  content: { relative: true, files: ['./src/**/*.{ts,tsx}'] },
  presets: [nativewindPreset],
  theme: {
    colors: {
      transparent: 'transparent',
      background: colors.background,
      surface: colors.surface,
      border: colors.border,
      foreground: { DEFAULT: colors.text, muted: colors.textMuted },
      primary: { DEFAULT: colors.primary, foreground: colors.onPrimary },
    },
    fontFamily: {
      heading: [fonts.heading],
      numeric: [fonts.numeric],
      body: [fonts.body],
      'body-strong': [fonts.bodyStrong],
    },
    fontSize: toPx(fontSizes),
    borderRadius: { none: '0px', ...toPx(radius) },
    extend: {
      // Nomes dos tokens (p-lg, gap-md) além da escala numérica do Tailwind (h-12 = 48px).
      spacing: toPx(spacing),
    },
  },
} satisfies Config;

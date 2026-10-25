import { colorVar } from './src/theme/apply-theme';
import { breakpoints, fonts, fontSizes, layout, radius, spacing } from './src/theme/tokens';

import type { Config } from 'tailwindcss';

import type { ColorToken } from './src/theme/tokens';

const px = (value: number): string => `${String(value)}px`;

const toPx = <K extends string>(scale: Record<K, number>): Record<K, string> =>
  Object.fromEntries(
    Object.entries<number>(scale).map(([key, value]) => [key, px(value)]),
  ) as Record<K, string>;

/**
 * Cor pela variável aplicada por applyTheme(), com cor do sistema como fallback:
 * se o tema não carregar, a tela continua legível.
 */
const color = (token: ColorToken, fallback: string): string =>
  `var(${colorVar(token)}, ${fallback})`;

/**
 * Tema do Tailwind gerado a partir de src/theme/tokens.ts (mesmos nomes do app mobile).
 * Cores, fontes, tamanhos de texto, raios e faixas de tela SUBSTITUEM os do Tailwind:
 * só existe o que é do design system (ex.: não há `bg-red-500` nem `sm:`).
 *
 *   bg-background · bg-surface · border-border · bg-primary · text-primary-foreground
 *   text-foreground · text-foreground-muted · font-heading · text-xl · rounded-md · p-lg
 *   md: (744px+) · lg: (1024px+) · xl: (1440px+)
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: {
    // hover: só em quem tem mouse; no toque (iPhone/iPad) o hover "grudava" depois do clique.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    screens: toPx(breakpoints),
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      background: color('background', 'Canvas'),
      surface: color('surface', 'Canvas'),
      border: color('border', 'GrayText'),
      foreground: {
        DEFAULT: color('text', 'CanvasText'),
        muted: color('textMuted', 'CanvasText'),
      },
      primary: {
        DEFAULT: color('primary', 'CanvasText'),
        foreground: color('onPrimary', 'Canvas'),
      },
      danger: color('danger', 'CanvasText'),
    },
    fontFamily: {
      heading: [fonts.heading],
      body: [fonts.body],
    },
    fontSize: toPx(fontSizes),
    borderRadius: { none: '0px', full: '9999px', ...toPx(radius) },
    extend: {
      // Nomes dos tokens (p-lg, gap-md) além da escala numérica do Tailwind (h-12 = 48px).
      spacing: {
        ...toPx(spacing),
        header: px(layout.headerHeight),
        sidebar: px(layout.sidebarWidth),
      },
      maxWidth: { content: px(layout.contentMax) },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        // Carregando: invisível nos primeiros 300ms, para respostas rápidas não piscarem.
        'fade-in-delayed': 'fade-in 150ms ease-out 300ms both',
        'spin-slow': 'spin 2.4s linear infinite',
      },
    },
  },
} satisfies Config;

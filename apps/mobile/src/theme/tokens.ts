/**
 * Tokens do design system: a única fonte de cores, fontes e espaçamentos do app.
 * Telas usam os tokens, nunca valores soltos (ex.: `colors.text`, não '#F1F4FA').
 *
 * Paleta A3 (tema escuro): azul royal escuro no fundo e nas superfícies, tangerina nas ações.
 */
const palette = {
  royal950: '#081225',
  royal900: '#0E1B35',
  royal700: '#1F3460',
  white: '#F1F4FA',
  slate: '#9EAED0',
  tangerine: '#F28705',
} as const;

export const colors = {
  background: palette.royal950, // fundo das telas e dos campos
  surface: palette.royal900, // cards
  border: palette.royal700, // bordas, divisores, estados de foco
  text: palette.white,
  textMuted: palette.slate, // texto secundário
  primary: palette.tangerine, // botão principal
  onPrimary: palette.royal950, // texto sobre o botão principal
} as const;

/** Nomes registrados em src/theme/fonts.ts. Space Grotesk: títulos e números; Inter: interface. */
export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  numeric: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyStrong: 'Inter_600SemiBold',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Escala de 4 em 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;

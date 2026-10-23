/**
 * Tokens do design system: a única fonte de cores, fontes e espaçamentos do app.
 * Telas usam os tokens, nunca valores soltos (ex.: `colors.text`, não '#FCF1D0').
 *
 * Paleta da Fase 1 (tema escuro): os azuis são fundo; texto, campos e botões usam o creme.
 */
const palette = {
  navy900: '#010736',
  navy800: '#0D1C42',
  navy700: '#22396F',
  cream: '#FCF1D0',
} as const;

export const colors = {
  background: palette.navy900, // fundo das telas
  surface: palette.navy800, // cards, campos
  border: palette.navy700, // bordas, divisores, estados de foco
  text: palette.cream,
  textMuted: 'rgba(252, 241, 208, 0.7)', // creme com 70% de opacidade
  primary: palette.cream, // botão principal
  onPrimary: palette.navy900, // texto sobre o botão principal
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

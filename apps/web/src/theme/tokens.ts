/**
 * Design tokens do painel (FE-SET-02): fonte única de cores, fontes, tamanhos e faixas de tela.
 *
 * O tailwind.config.ts gera as classes a partir daqui (ex.: `bg-surface`, `text-foreground`,
 * `p-md`, `md:`). Os nomes seguem os do app mobile, para a mesma classe significar o mesmo.
 *
 * Paleta da Fase 1 (tema escuro): os azuis são fundo; texto, campos e botões usam o creme.
 */
export const colors = {
  /** Fundo da página. */
  background: '#010736',
  /** Superfícies: cards, painéis, campos. */
  surface: '#0D1C42',
  /** Bordas, divisores e hover. */
  border: '#22396F',
  /** Texto e ícones. */
  text: '#FCF1D0',
  /** Texto secundário: o mesmo creme, mais apagado. */
  textMuted: 'rgb(252 241 208 / 70%)',
  /** Botão principal. */
  primary: '#FCF1D0',
  /** Texto sobre o botão principal. */
  onPrimary: '#010736',
  /** Erros e validações: coral claro, legível sobre os azuis (contraste ≥ 7:1 no surface). */
  danger: '#FF9E8F',
} as const;

/** Fontes com fallback: se a fonte web não carregar, o navegador usa a do sistema. */
export const fonts = {
  /** Títulos e números. */
  heading: "'Space Grotesk', system-ui, sans-serif",
  /** Interface (textos, campos, botões). */
  body: "'Inter', system-ui, sans-serif",
} as const;

/** Tamanhos de texto em px (mesma escala do mobile). */
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Espaçamentos em px, de 4 em 4 (mesma escala do mobile). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Raios de borda em px. */
export const radius = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;

/**
 * Faixas de tela (FE-SET-03), em px, a partir de onde valem. Abaixo de `md` é celular (360px+).
 * - md   744: tablet em pé — iPad mini (744), iPad 10ª/Air (820), iPad Pro 11" (834), Galaxy Tab S9 (800)
 * - lg  1024: iPad deitado (1133–1376), iPad Pro 13" em pé (1032) e computadores
 * - xl  1440: monitores grandes
 */
export const breakpoints = {
  md: 744,
  lg: 1024,
  xl: 1440,
} as const;

/** Medidas fixas da moldura do app, em px. */
export const layout = {
  headerHeight: 56,
  sidebarWidth: 248,
  contentMax: 1200,
} as const;

export type ColorToken = keyof typeof colors;

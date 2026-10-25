import { colors } from './tokens';

import type { ColorToken } from './tokens';

/**
 * Cor de segurança para cada token: cores do sistema (`Canvas`/`CanvasText`), que o
 * navegador sempre garante legíveis entre si. Usadas só se um token vier inválido.
 */
const safeColors: Record<ColorToken, string> = {
  background: 'Canvas',
  surface: 'Canvas',
  border: 'GrayText',
  text: 'CanvasText',
  textMuted: 'CanvasText',
  primary: 'CanvasText',
  onPrimary: 'Canvas',
  danger: 'CanvasText',
};

/** `textMuted` → `--hf-color-text-muted`. */
export function colorVar(token: ColorToken): string {
  return `--hf-color-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/**
 * Aplica as cores como variáveis CSS no `<html>`. As classes do Tailwind leem essas variáveis
 * (tailwind.config.ts), sempre com uma cor do sistema como fallback.
 *
 * Nunca derruba o app: se uma cor for inválida, usa a cor de segurança daquele token;
 * se algo falhar de vez, não aplica nada e cada classe cai na cor do sistema.
 * Em qualquer falha marca `<html data-theme="fallback">` (a ThemeNotice avisa o usuário).
 *
 * @returns `true` se o tema foi aplicado sem problemas.
 */
export function applyTheme(root: HTMLElement = document.documentElement): boolean {
  try {
    let ok = true;

    Object.entries(colors).forEach(([name, value]) => {
      const token = name as ColorToken;
      const valid = CSS.supports('color', value);
      if (!valid) {
        ok = false;
        console.warn(`[tema] Cor inválida em "${token}": "${value}". Usando cor de segurança.`);
      }
      root.style.setProperty(colorVar(token), valid ? value : safeColors[token]);
    });

    root.dataset['theme'] = ok ? 'default' : 'fallback';
    return ok;
  } catch (error) {
    console.error('[tema] Não foi possível aplicar o tema. Usando cores do sistema.', error);
    root.dataset['theme'] = 'fallback';
    return false;
  }
}

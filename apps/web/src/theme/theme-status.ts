/**
 * Saúde do tema: o app marca `<html data-theme="fallback">` quando as cores não carregaram
 * direito, e a ThemeNotice avisa o usuário. O app continua funcionando nas cores do sistema.
 */

/**
 * Confere se o CSS do app chegou (em produção é um arquivo separado, que pode falhar ao baixar).
 * @returns `true` se o CSS carregou.
 */
export function verifyStylesheet(root: HTMLElement = document.documentElement): boolean {
  const loaded = getComputedStyle(root).getPropertyValue('--hf-styles-loaded').trim() === '1';
  if (!loaded) {
    console.error('[tema] O CSS do painel não carregou. Usando o estilo padrão do navegador.');
    root.dataset['theme'] = 'fallback';
  }
  return loaded;
}

/** O tema caiu no modo de segurança? (cor inválida, tema não aplicado ou CSS não carregou). */
export function isThemeFallback(root: HTMLElement = document.documentElement): boolean {
  return root.dataset['theme'] === 'fallback';
}

/** Configuração do app lida das variáveis de ambiente (ver .env.example). */
export const config = Object.freeze({
  // `||` de propósito: vazio ("VITE_API_URL=") também cai no padrão "/api" (proxy do Vite em dev).
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  apiUrl: import.meta.env.VITE_API_URL?.trim() || '/api',
});

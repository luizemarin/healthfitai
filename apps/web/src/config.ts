/** Id usado em dev quando VITE_PROFISSIONAL_ID não está definido (ver .env.example). */
const PROFISSIONAL_ID_DEV = '00000000-0000-4000-8000-000000000001';

/** Configuração do app lida das variáveis de ambiente (ver .env.example). */
export const config = Object.freeze({
  // `||` de propósito: vazio ("VITE_API_URL=") também cai no padrão "/api" (proxy do Vite em dev).
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  apiUrl: import.meta.env.VITE_API_URL?.trim() || '/api',

  /**
   * PROVISÓRIO até o login (FE-AUT-01): a API identifica o profissional pelo header
   * X-Profissional-Id. Quando o login chegar, o id passa a vir do token e isto sai.
   */
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  profissionalId: import.meta.env.VITE_PROFISSIONAL_ID?.trim() || PROFISSIONAL_ID_DEV,
});

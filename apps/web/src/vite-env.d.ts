/// <reference types="vite/client" />

/** Variáveis de ambiente expostas ao navegador (ver .env.example). */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PROFISSIONAL_ID?: string;
}

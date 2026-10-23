/** Variáveis de ambiente embutidas no app pelo Expo (ver .env.example). */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
  }
}

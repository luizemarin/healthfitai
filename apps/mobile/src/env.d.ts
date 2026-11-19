/** Variáveis de ambiente embutidas no app pelo Expo (ver .env.example). */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_ALUNO_ID?: string;
    readonly EXPO_PUBLIC_PROFISSIONAL_ID?: string;
    readonly EXPO_PUBLIC_SKIP_LOGIN?: string;
  }
}

/** CSS importado só pelo efeito (src/theme/global.css, entrada do NativeWind). */
declare module '*.css';

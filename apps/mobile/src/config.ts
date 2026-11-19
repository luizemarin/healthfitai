import Constants from 'expo-constants';

const API_PORT = 3333;

/** Id usado em dev quando EXPO_PUBLIC_PROFISSIONAL_ID não está definido (o mesmo do painel web). */
const PROFISSIONAL_ID_DEV = '00000000-0000-4000-8000-000000000001';

/**
 * Em dev, a API roda na mesma máquina do Expo. O celular não enxerga "localhost" do computador,
 * então usamos o IP que o Expo já usa para servir o app (ex.: "192.168.0.10:8081" → 192.168.0.10).
 */
function devApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:${API_PORT}`;
}

function resolveApiUrl(): string {
  // Acesso com ponto de propósito: o Expo só substitui `process.env.EXPO_PUBLIC_*` escrito assim.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (__DEV__) {
    return devApiUrl();
  }
  throw new Error('EXPO_PUBLIC_API_URL não definida para o build de produção.');
}

/** Texto da variável sem espaços nas pontas, ou null se ausente/vazia. */
function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

/** Configuração do app lida das variáveis de ambiente (ver .env.example). */
export const config = Object.freeze({
  apiUrl: resolveApiUrl(),

  /**
   * PROVISÓRIO até o login do aluno trazer esses dados no token (BE-AUT-01): as rotas do aluno
   * ainda pedem o id do aluno na URL e o do profissional no header X-Profissional-Id (o painel web
   * faz igual). Quando o token chegar, isto sai e só anamnese/anamnese-api.ts muda.
   * null = não configurado: a tela mostra uma mensagem amigável em vez de quebrar.
   */
  alunoId: optional(process.env.EXPO_PUBLIC_ALUNO_ID),
  profissionalId:
    optional(process.env.EXPO_PUBLIC_PROFISSIONAL_ID) ?? (__DEV__ ? PROFISSIONAL_ID_DEV : null),

  /**
   * PROVISÓRIO até o login existir na API (BE-AUT-01): pula a tela de login para ver as telas do
   * aluno. Só vale em dev (__DEV__); num build de produção é sempre false.
   */
  skipLogin: __DEV__ && process.env.EXPO_PUBLIC_SKIP_LOGIN === 'true',
});

import Constants from 'expo-constants';

const API_PORT = 3333;

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fromEnv;
  }
  if (__DEV__) {
    return devApiUrl();
  }
  throw new Error('EXPO_PUBLIC_API_URL não definida para o build de produção.');
}

/** Configuração do app lida das variáveis de ambiente (ver .env.example). */
export const config = Object.freeze({
  apiUrl: resolveApiUrl(),
});

import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

/**
 * Sessão do aluno: guarda os tokens e avisa quem estiver ouvindo quando ela muda.
 *
 * Persistida no armazenamento seguro do aparelho (Keychain no iOS, Keystore no Android) via
 * expo-secure-store: nunca em AsyncStorage, que é texto aberto. Em memória fica uma cópia para
 * leitura síncrona (client de API e telas).
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
}

type Listener = () => void;

const STORAGE_KEY = 'healthfitai.session';

export function isSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Session).accessToken === 'string' &&
    typeof (value as Session).refreshToken === 'string'
  );
}

let current: Session | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function persist(session: Session | null): void {
  const write = session
    ? setItemAsync(STORAGE_KEY, JSON.stringify(session))
    : deleteItemAsync(STORAGE_KEY);

  write.catch((error: unknown) => {
    // Armazenamento indisponível: a sessão segue só em memória até fechar o app.
    console.warn('[sessão] Não foi possível gravar no armazenamento seguro.', error);
  });
}

function update(session: Session | null): void {
  current = session;
  persist(session);
  notify();
}

export const sessionStore = {
  get: (): Session | null => current,

  /**
   * Carrega a sessão salva ao abrir o app.
   * Qualquer problema (dado corrompido, armazenamento bloqueado) vira "sem sessão": o aluno
   * só precisa entrar de novo.
   */
  hydrate: async (): Promise<void> => {
    try {
      const raw = await getItemAsync(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      current = isSession(parsed) ? parsed : null;
    } catch {
      current = null;
    }
    notify();
  },

  /** Inicia ou renova a sessão (login, refresh). */
  set: (session: Session): void => {
    update(session);
  },

  /** Encerra a sessão (logout, refresh falhou). */
  clear: (): void => {
    update(null);
  },

  /** Retorna a função para cancelar a inscrição (formato do useSyncExternalStore). */
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

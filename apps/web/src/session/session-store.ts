/**
 * Sessão do profissional: guarda os tokens e avisa quem estiver ouvindo quando ela muda.
 *
 * É TypeScript puro (sem React) para ser usada tanto pelo client de API quanto pelas telas
 * (via useSession). Persistida no sessionStorage: sobrevive ao F5 e some ao fechar a aba.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
}

type Listener = () => void;

const STORAGE_KEY = 'healthfitai.session';

function isSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Session).accessToken === 'string' &&
    typeof (value as Session).refreshToken === 'string'
  );
}

/** Lê a sessão salva; qualquer problema (storage bloqueado, JSON inválido) vira "sem sessão". */
function load(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(session: Session | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage indisponível (aba anônima, bloqueio): a sessão segue só em memória.
  }
}

let current: Session | null = load();
const listeners = new Set<Listener>();

function update(session: Session | null): void {
  current = session;
  persist(session);
  listeners.forEach((listener) => {
    listener();
  });
}

export const sessionStore = {
  get: (): Session | null => current,

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

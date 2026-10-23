import { useSyncExternalStore } from 'react';

import { sessionStore } from './session-store';

import type { Session } from './session-store';

/** Sessão atual para as telas; o componente re-renderiza quando ela muda (login, refresh, logout). */
export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
}

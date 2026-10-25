import { useCallback, useEffect, useState } from 'react';

import type { DependencyList } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

export type AsyncResult<T> = AsyncState<T> & {
  /** Busca de novo (usado pelo "Tentar novamente"). */
  reload: () => void;
};

/** Resultado de uma busca, junto com "para quais deps/tentativa" ele vale. */
interface Settled<T> {
  deps: DependencyList;
  attempt: number;
  state: AsyncState<T>;
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Carrega dados e devolve o estado no formato padrão das telas: loading | error | success.
 *
 *   const alunos = useAsync(async (signal) => unwrap(api.GET('/students', { signal })), []);
 *
 * Funciona como o useEffect: busca de novo quando `deps` muda. Cancela a busca anterior
 * (AbortSignal) ao trocar de deps ou sair da tela, então resposta velha nunca sobrescreve a nova.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): AsyncResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const done = (state: AsyncState<T>): void => {
      if (!controller.signal.aborted) {
        setSettled({ deps, attempt, state });
      }
    };

    load(controller.signal).then(
      (data) => {
        done({ status: 'success', data });
      },
      (error: unknown) => {
        done({ status: 'error', error });
      },
    );

    return () => {
      controller.abort();
    };
    // As deps vêm de quem chama; o ESLint as confere lá (additionalHooks em eslint.config.mjs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  // O resultado guardado só vale para as deps/tentativa atuais; senão, ainda está carregando.
  const isCurrent = settled?.attempt === attempt && sameDeps(settled.deps, deps);
  const state: AsyncState<T> = isCurrent ? settled.state : { status: 'loading' };

  return { ...state, reload };
}

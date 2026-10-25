import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useLocation } from 'react-router';

import { ApiError } from '../../api/api-error';
import { describeError } from '../states/describe-error';

import type { ReactElement, ReactNode } from 'react';

/**
 * Avisos rápidos (toasts) no canto da tela.
 *
 *   const toast = useToast();
 *   toast.success('Aluno cadastrado.');
 *   toast.error('Verifique os campos destacados', 'Corrija e tente de novo.');
 *   toast.fromError(erro, 'Não foi possível salvar'); // erro capturado → texto amigável
 *
 * Regras:
 * - Sucesso some sozinho em 4s.
 * - Erro FICA até a pessoa fechar, até a próxima ação dar certo ou até sair da tela:
 *   não dá para perder o aviso, e aviso velho não cobre a tela seguinte.
 * - Aviso com o mesmo título substitui o anterior (não empilha).
 * - Erros de validação da API (details) aparecem em lista dentro do aviso.
 * O provider fica dentro do roteador (RootLayout) para saber em que tela está.
 */
type ToastKind = 'success' | 'error';

interface ToastContent {
  kind: ToastKind;
  title: string;
  message?: string | undefined;
  items?: readonly string[] | undefined;
}

interface Toast extends ToastContent {
  id: number;
  /** Tela onde o aviso nasceu: erro só aparece nela. */
  pathname: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string, items?: readonly string[]) => void;
  /** Erro capturado (ApiError, rede…): vira título e mensagem amigáveis via describeError. */
  fromError: (error: unknown, title?: string) => void;
}

const SUCCESS_DURATION_MS = 4000;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast precisa estar dentro do <ToastProvider>.');
  }
  return api;
}

/** Monta o aviso de erro: título/mensagem amigáveis + problemas por campo vindos da API. */
function toErrorToast(error: unknown, title: string | undefined): ToastContent {
  const friendly = describeError(error);
  const items = error instanceof ApiError ? error.details.map((detail) => detail.message) : [];
  return {
    kind: 'error',
    title: title ?? friendly.title,
    message: friendly.message,
    items: items.length > 0 ? items : undefined,
  };
}

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const { pathname } = useLocation();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (content: ToastContent) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [
        ...current.filter((toast) => {
          const outraTela = toast.kind === 'error' && toast.pathname !== pathname;
          const mesmoTitulo = toast.title === content.title;
          const erroResolvido = content.kind === 'success' && toast.kind === 'error';
          return !outraTela && !mesmoTitulo && !erroResolvido;
        }),
        { ...content, id, pathname },
      ]);
      if (content.kind === 'success') {
        setTimeout(() => dismiss(id), SUCCESS_DURATION_MS);
      }
    },
    [dismiss, pathname],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push({ kind: 'success', title, message }),
      error: (title, message, items) =>
        push({ kind: 'error', title, message, items: items?.length ? items : undefined }),
      fromError: (error, title) => push(toErrorToast(error, title)),
    }),
    [push],
  );

  // Saiu da tela: os erros eram dela. O sucesso continua (ex.: "Aluno cadastrado." ao abrir a ficha).
  const visiveis = toasts.filter(
    (toast) => toast.kind === 'success' || toast.pathname === pathname,
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        Celular/tablet: embaixo, para não cobrir o campo com erro (que recebe o foco no topo).
        Desktop (lg+): canto superior direito, abaixo do cabeçalho.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex flex-col items-stretch gap-sm px-md lg:bottom-auto lg:left-auto lg:top-[calc(theme(spacing.header)+8px)] lg:w-[400px]">
        {visiveis.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }): ReactElement {
  const isError = toast.kind === 'error';

  return (
    <div
      // alert: o leitor de tela anuncia o erro na hora; status: anuncia o sucesso sem interromper.
      role={isError ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-surface p-md shadow-lg ${
        isError ? 'border-danger' : 'border-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center rounded-full font-bold ${
          isError ? 'bg-danger text-background' : 'bg-primary text-primary-foreground'
        }`}
      >
        {isError ? '!' : '✓'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`m-0 font-semibold ${isError ? 'text-danger' : ''}`}>{toast.title}</p>
        {toast.message && (
          <p className="m-0 mt-xs text-sm text-foreground-muted">{toast.message}</p>
        )}
        {toast.items && (
          <ul className="m-0 mt-xs list-disc pl-md text-sm">
            {toast.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="-m-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-sm hover:bg-border"
        aria-label="Fechar aviso"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

import { Component } from 'react';

import { ErrorState } from '../states';

import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

/**
 * Última rede de proteção: pega o que escapar do roteador (inclusive a própria tela de erro
 * quebrando). Sem isso, a pessoa veria uma página em branco.
 * Componente de classe porque o React só oferece error boundary nesse formato.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error('Erro desconhecido') };
  }

  public override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[app] Erro não tratado.', error, info.componentStack);
  }

  public override render(): ReactNode {
    const { error } = this.state;
    const { children } = this.props;

    if (!error) {
      return children;
    }

    return (
      <div className="grid min-h-dvh place-items-center p-md">
        <ErrorState
          error={error}
          title="Não conseguimos abrir o painel"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}

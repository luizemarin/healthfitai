import { useEffect } from 'react';

import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { EmptyState, ErrorState } from '../components/states';

import type { ReactElement } from 'react';

/**
 * Tela amigável quando uma página quebra ao carregar ou renderizar.
 * O detalhe técnico vai para o console; o usuário vê só o que pode fazer.
 */
export function ErrorPage(): ReactElement {
  const error = useRouteError();

  useEffect(() => {
    console.error('[tela] Falha ao carregar a página.', error);
  }, [error]);

  const homeLink = (
    <Link to="/" className="hf-button hf-button--secondary">
      Voltar ao início
    </Link>
  );

  return (
    <main className="grid min-h-dvh place-items-center p-md">
      {isRouteErrorResponse(error) && error.status === 404 ? (
        <EmptyState
          title="Página não encontrada"
          description="O endereço pode ter mudado ou não existe mais."
          action={homeLink}
        />
      ) : (
        <ErrorState
          error={error}
          title="Não conseguimos carregar esta tela"
          onRetry={() => window.location.reload()}
          action={homeLink}
        />
      )}
    </main>
  );
}

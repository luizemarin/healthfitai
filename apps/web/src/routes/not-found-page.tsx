import { Link } from 'react-router';

import { EmptyState } from '../components/states';

import type { ReactElement } from 'react';

export function NotFoundPage(): ReactElement {
  return (
    <EmptyState
      title="Página não encontrada"
      description="O endereço pode ter mudado ou não existe mais."
      action={
        <Link to="/" className="hf-button hf-button--secondary">
          Voltar ao início
        </Link>
      }
    />
  );
}

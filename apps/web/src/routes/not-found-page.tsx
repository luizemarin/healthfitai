import { Link } from 'react-router';

import type { ReactElement } from 'react';

export function NotFoundPage(): ReactElement {
  return (
    <>
      <h1>Página não encontrada</h1>
      <Link to="/">Voltar ao início</Link>
    </>
  );
}

import { useSession } from '../session/use-session';

import type { ReactElement } from 'react';

export function HomePage(): ReactElement {
  const session = useSession();

  return (
    <>
      <h1>Painel do profissional</h1>
      <p>{session ? 'Sessão ativa.' : 'Nenhuma sessão ativa.'}</p>
    </>
  );
}

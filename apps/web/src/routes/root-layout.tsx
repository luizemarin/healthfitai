import { Outlet } from 'react-router';

import type { ReactElement } from 'react';

/** Moldura comum das páginas. Menu e cabeçalho entram aqui quando forem criados. */
export function RootLayout(): ReactElement {
  return (
    <main>
      <Outlet />
    </main>
  );
}

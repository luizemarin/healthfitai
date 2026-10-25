import { createBrowserRouter } from 'react-router';

import { DevStatesPage } from './dev-states-page';
import { ErrorPage } from './error-page';
import { HomePage } from './home-page';
import { NotFoundPage } from './not-found-page';
import { RootLayout } from './root-layout';
import { AlunoFichaPage } from '../features/alunos/aluno-ficha-page';
import { AlunoEditarPage, AlunoNovoPage } from '../features/alunos/aluno-form-page';
import { AlunosListaPage } from '../features/alunos/alunos-lista-page';

import type { RouteObject } from 'react-router';

/** Páginas de apoio ao desenvolvimento: não entram no build de produção. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '_dev/estados', element: <DevStatesPage /> }]
  : [];

/**
 * Mapa de rotas do painel. Cada nova tela entra como filha do RootLayout.
 * Rotas que exigem login serão agrupadas sob um guard (FE-AUT-01).
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    // Qualquer tela que quebrar mostra a mensagem amigável em vez de uma página em branco.
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      // Alunos: FE-ALU-01 lista · FE-ALU-02 cadastro/edição · FE-ALU-03/04 ficha com convite e abas
      { path: 'alunos', element: <AlunosListaPage /> },
      { path: 'alunos/novo', element: <AlunoNovoPage /> },
      { path: 'alunos/:id', element: <AlunoFichaPage /> },
      { path: 'alunos/:id/editar', element: <AlunoEditarPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

import { createBrowserRouter } from 'react-router';

import { HomePage } from './home-page';
import { NotFoundPage } from './not-found-page';
import { RootLayout } from './root-layout';

/**
 * Mapa de rotas do painel. Cada nova tela entra como filha do RootLayout.
 * Rotas que exigem login serão agrupadas sob um guard (FE-AUT-01).
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

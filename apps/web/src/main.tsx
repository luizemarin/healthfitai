import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppErrorBoundary } from './components/layout/app-error-boundary';
import { router } from './routes/router';
import './styles.css';
import { applyTheme } from './theme/apply-theme';
import { verifyStylesheet } from './theme/theme-status';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

// Antes de renderizar, para a primeira tela já sair com as cores certas.
// Se algo falhar, marca data-theme="fallback" e a ThemeNotice avisa o usuário.
applyTheme();
verifyStylesheet();

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </StrictMode>,
);

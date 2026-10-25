import { Outlet } from 'react-router';

import { ToastProvider } from '../components/feedback/toast';
import { AppShell } from '../components/layout/app-shell';

import type { ReactElement } from 'react';

/** Moldura comum das páginas: o AppShell responsivo com a página atual dentro e os avisos (toasts). */
export function RootLayout(): ReactElement {
  return (
    <ToastProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ToastProvider>
  );
}

import { useEffect, useState } from 'react';

import { NavLink } from 'react-router';

import { ThemeNotice } from './theme-notice';

import type { ReactElement, ReactNode } from 'react';

/** Itens do menu. Cada tela nova entra aqui. */
const navItems = [
  { to: '/', label: 'Início', end: true },
  // Sem `end`: continua marcado dentro de /alunos/novo, /alunos/:id…
  { to: '/alunos', label: 'Alunos', end: false },
] as const;

interface AppShellProps {
  children: ReactNode;
}

/**
 * Moldura responsiva do painel (FE-SET-03):
 * - celular e tablet em pé (< lg, 1024px): cabeçalho com botão ☰ que abre o menu em gaveta;
 * - desktop e iPad deitado (lg+): menu fixo na lateral.
 * A gaveta abre/fecha pelo atributo `data-nav-open` (classes `group-data-[nav-open=true]:`).
 */
export function AppShell({ children }: AppShellProps): ReactElement {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = (): void => {
    setNavOpen(false);
  };

  // Esc fecha a gaveta.
  useEffect(() => {
    if (!navOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navOpen]);

  return (
    <div className="group flex min-h-dvh flex-col" data-nav-open={navOpen}>
      <ThemeNotice />

      {/* safe-area: o cabeçalho não fica embaixo do notch / Dynamic Island. */}
      <header className="hf-gutter-x sticky top-0 z-10 flex min-h-[calc(theme(spacing.header)+env(safe-area-inset-top))] items-center gap-sm border-b border-border bg-background pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          className="-ml-2.5 grid size-11 cursor-pointer place-items-center rounded-sm lg:hidden"
          aria-expanded={navOpen}
          aria-controls="hf-nav"
          aria-label={navOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setNavOpen((open) => !open)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <span className="font-heading text-lg font-bold">HealthFitAI</span>
      </header>

      <div className="flex-1 lg:grid lg:grid-cols-[theme(spacing.sidebar)_minmax(0,1fr)]">
        {/*
          < lg: gaveta fixa que desliza da esquerda (invisible = fechada não recebe foco pelo Tab).
          lg+:  menu lateral fixo abaixo do cabeçalho.
        */}
        <nav
          id="hf-nav"
          aria-label="Menu principal"
          className="invisible fixed inset-y-0 left-0 z-30 w-[min(80vw,300px)] -translate-x-full overflow-y-auto border-r border-border bg-surface px-3 pb-md pl-[max(theme(spacing.3),env(safe-area-inset-left))] pt-[calc(theme(spacing.md)+env(safe-area-inset-top))] transition-[transform,visibility] duration-200 group-data-[nav-open=true]:visible group-data-[nav-open=true]:translate-x-0 motion-reduce:transition-none lg:visible lg:sticky lg:top-header lg:h-[calc(100dvh-theme(spacing.header))] lg:w-auto lg:translate-x-0 lg:pt-md lg:transition-none"
        >
          <ul className="grid gap-xs">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeNav}
                  className="flex min-h-11 items-center rounded-sm px-3 no-underline hover:bg-border aria-[current=page]:bg-border aria-[current=page]:font-semibold"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Fundo escuro atrás da gaveta: tocar fora fecha. Fora da ordem do Tab (o Esc já fecha). */}
        <button
          type="button"
          className="fixed inset-0 z-20 hidden bg-[rgb(0_0_0/50%)] group-data-[nav-open=true]:block lg:hidden"
          aria-label="Fechar menu"
          tabIndex={-1}
          onClick={closeNav}
        />

        <main className="min-w-0 pb-[calc(theme(spacing.12)+env(safe-area-inset-bottom))] pt-lg">
          <div className="hf-container">{children}</div>
        </main>
      </div>
    </div>
  );
}

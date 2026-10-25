# @healthfitai/web — Painel do profissional

React + TypeScript (Vite) + Tailwind 3.4. Base do painel: roteamento, client de API tipado e sessão (FE-SET-01); design system e tokens (FE-SET-02); responsividade (FE-SET-03); estados vazio, carregando e erro (FE-SET-04).

## Rodando

```bash
cp apps/web/.env.example apps/web/.env   # opcional: os padrões já funcionam
npm run dev:api                           # API em http://localhost:3333
npm run dev:web                           # painel em http://localhost:5173
```

Em dev, o painel chama `/api/*` e o Vite repassa para a API (sem CORS).

## Estrutura

```
tailwind.config.ts         tema do Tailwind, gerado de src/theme/tokens.ts
postcss.config.mjs         liga o Tailwind no Vite
src/
  main.tsx                 sobe o React com o roteador
  config.ts                variáveis de ambiente (VITE_API_URL)
  styles.css               Tailwind + estilos base e classes próprias (hf-button, hf-container…)
  routes/                  mapa de rotas (router.tsx), layout e páginas
  components/
    layout/                AppShell responsivo, aviso de tema e error boundary do app
    states/                LoadingState, EmptyState, ErrorState, AsyncContent e useAsync
    feedback/              avisos (toast) e diálogo de confirmação
    form/                  Field: label com * de obrigatório, dica e erro do campo
  features/
    alunos/                lista, cadastro/edição, ficha por abas e convite (FE-ALU-01..04)
  api/
    client.ts              `api` (com token) e `publicApi` (sem token) + `unwrap`
    api-error.ts           ApiError: formato único de erro para as telas
    generated/schema.ts    tipos gerados do OpenAPI — não editar à mão
  theme/
    tokens.ts              cores, fontes, tamanhos, espaçamentos e faixas de tela (fonte única)
    apply-theme.ts         aplica as cores como variáveis CSS (--hf-color-*) ao subir o app
    theme-status.ts        detecta se as cores/CSS não carregaram
  session/
    session-store.ts       guarda os tokens (sessionStorage) e avisa mudanças
    use-session.ts         hook para as telas lerem a sessão
```

## Chamando a API

Os tipos vêm do contrato da API. Quando a API mudar uma rota:

```bash
npm run api:types   # regenera apps/api/openapi.json e os tipos do web
```

```ts
import { api, unwrap } from '../api/client';

const alunos = await unwrap(api.GET('/students', { params: { query: { page: 1 } } }));
// erro → lança ApiError { status, code, message, details } (status 0 = sem conexão)
```

## Sessão

- `sessionStore.set({ accessToken, refreshToken })` inicia a sessão; `sessionStore.clear()` encerra.
- `api` envia `Authorization: Bearer <accessToken>` em toda chamada.
- Recebeu 401: renova a sessão **uma vez** (mesmo com várias chamadas ao mesmo tempo) e repete a chamada.
  Se não conseguir renovar, encerra a sessão — as telas reagem via `useSession()`.
- A rota de refresh chega com a autenticação (BE-AUT-03 / FE-AUT-01), registrada assim:

```ts
setRefreshSession(async (refreshToken) =>
  unwrap(publicApi.POST('/auth/refresh', { body: { refreshToken } })),
);
```

## Design system (FE-SET-02) — Tailwind

Estilo com **Tailwind 3.4** (mesma versão e mesmos nomes de classe do app mobile/NativeWind).
Os valores ficam só em `src/theme/tokens.ts`; o `tailwind.config.ts` gera as classes a partir deles.
Cores, fontes, tamanhos de texto, raios e faixas de tela **substituem** os do Tailwind:
só existe o que é do design system (não há `bg-red-500` nem `sm:`).

| Classe                                      | Uso                                                                |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `bg-background`                             | fundo da página                                                    |
| `bg-surface`                                | cards, painéis, campos                                             |
| `border-border` / `hover:bg-border`         | bordas, divisores, hover                                           |
| `text-foreground` / `text-foreground-muted` | texto / texto secundário                                           |
| `bg-primary text-primary-foreground`        | botão principal                                                    |
| `font-heading` / `font-body`                | Space Grotesk (títulos/números) / Inter                            |
| `text-xs` … `text-xxl`                      | 12 · 14 · 16 · 20 · 24 · 32px                                      |
| `p-xs` … `p-xl` (e `gap-`, `m-`…)           | 4 · 8 · 16 · 24 · 32px (a escala numérica do Tailwind também vale) |
| `rounded-sm` / `rounded-md`                 | 8 / 12px                                                           |

```tsx
<div className="rounded-md border border-border bg-surface p-md">
  <h2 className="font-heading">Peso</h2>
  <p className="font-heading tabular-nums">72,4 kg</p>
</div>
```

Classes próprias (em `src/styles.css`): `hf-button` e `hf-button--secondary` (botões com 44px de altura),
`hf-container`, `hf-grid` e `hf-table-scroll` (ver Responsividade).

### Se algo falhar

As cores do Tailwind leem variáveis CSS aplicadas por `applyTheme()` ao subir o app, sempre com uma
cor do sistema de fallback (ex.: `var(--hf-color-background, Canvas)`):

- **Cor inválida em `tokens.ts`:** aquele token usa uma cor de segurança do sistema e aparece um aviso no console.
- **Tema não aplicado:** cada classe cai na cor do sistema (`Canvas`/`CanvasText`), sempre legível.
- **CSS do app não baixou:** detectado ao subir (`verifyStylesheet`).
  Nos três casos o `<html>` fica com `data-theme="fallback"` e aparece no topo um aviso amigável
  ("Não conseguimos carregar as cores do painel…") com **Recarregar** e **Fechar**. O painel continua usável.
- **Fontes não carregam:** o texto aparece na fonte do sistema (`display=swap`).
- **Uma tela quebra:** o roteador mostra `ErrorPage` com mensagem amigável e "Tentar novamente".
- **Algo escapa do roteador** (ex.: a própria tela de erro quebra): `AppErrorBoundary` mostra
  "Não conseguimos abrir o painel" em vez de página em branco.
- **O app nem sobe** (ex.: falha de rede ao baixar o JS): após 15s, o "Carregando o painel…" do
  `index.html` vira uma mensagem pedindo para verificar a conexão.

## Responsividade (FE-SET-03)

Mobile first: classe sem prefixo vale para o celular; `md:`, `lg:` e `xl:` acrescentam a partir da faixa.
Faixas em `tokens.ts` (`breakpoints`), aparelhos de ~2023 para cá:

| Prefixo | Largura | Aparelhos de referência                                                              | Menu         |
| ------- | ------- | ------------------------------------------------------------------------------------ | ------------ |
| —       | 360px+  | Galaxy S23/S24 (360), iPhone 15/16 (393), Pro Max (430)                              | gaveta (☰)  |
| `md:`   | 744px+  | iPad mini (744), iPad 10ª/Air (820), iPad Pro 11" (834), Galaxy Tab S9 (800) — em pé | gaveta (☰)  |
| `lg:`   | 1024px+ | iPad deitado (1133–1376), iPad Pro 13" em pé (1032), notebooks                       | lateral fixa |
| `xl:`   | 1440px+ | monitores grandes — o conteúdo para em 1200px e centraliza                           | lateral fixa |

```tsx
<div className="grid gap-md lg:grid-cols-2">…</div> // 1 coluna; 2 a partir do iPad deitado
```

- Abaixo de 360px (ex.: 320px) a página não quebra: rola de lado.
- Alvos de toque com no mínimo 44px (`min-h-11`); `hover:` só vale em quem tem mouse (`hoverOnlyWhenSupported`).
- iPhone com notch/Dynamic Island: `viewport-fit=cover` + `env(safe-area-inset-*)` no cabeçalho, menu e margens.
- A moldura (cabeçalho, menu em gaveta/lateral) fica em `components/layout/app-shell.tsx`.

| Classe            | Uso                                                             |
| ----------------- | --------------------------------------------------------------- |
| `hf-container`    | largura máxima + margens laterais (já aplicada pelo AppShell)   |
| `hf-grid`         | cards: 1 coluna no celular, quantas couberem (mín. 280px) acima |
| `hf-table-scroll` | envolve tabelas largas: rola de lado no celular                 |

## Estados das telas (FE-SET-04)

Toda tela que carrega dados usa o mesmo padrão: **carregando → erro | vazio | conteúdo**.

```tsx
import { AsyncContent, EmptyState, useAsync } from '../components/states';

const alunos = useAsync(async (signal) => unwrap(api.GET('/students', { signal })), []);

<AsyncContent
  state={alunos}
  loadingLabel="Carregando alunos…"
  isEmpty={(page) => page.items.length === 0}
  empty={<EmptyState title="Nenhum aluno cadastrado" description="Cadastre o primeiro aluno." />}
>
  {(page) => <ListaDeAlunos alunos={page.items} />}
</AsyncContent>;
```

- `useAsync(load, deps)`: igual ao `useEffect` — busca de novo quando `deps` muda (o ESLint confere as deps)
  e cancela a busca anterior. `reload()` busca de novo.
- **Carregando** (`LoadingState`): só aparece após 300ms, para respostas rápidas não piscarem.
- **Erro** (`ErrorState`): `describeError` traduz o erro em texto amigável — sem conexão, sessão expirada,
  sem permissão, não encontrado, servidor instável, painel atualizado. "Tentar novamente" só aparece
  quando faz sentido (não aparece para 401/403/404).
- **Vazio** (`EmptyState`): título, dica do que fazer e uma ação opcional.
- Os componentes também podem ser usados soltos (ex.: `EmptyState` na página 404).

Para conferir visual e responsividade sem a API: `npm run dev:web` e abra
`http://localhost:5173/_dev/estados` (rota só existe em desenvolvimento).

## Alunos (FE-ALU-01..04)

| Rota                 | Tela                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `/alunos`            | Lista: busca, filtros de situação e sexo, paginação (filtros ficam na URL) |
| `/alunos/novo`       | Cadastro                                                                   |
| `/alunos/:id`        | Ficha: perfil, ativar/desativar, convite e abas (`?aba=fotos`)             |
| `/alunos/:id/editar` | Edição                                                                     |

- Chamadas à API só em `features/alunos/alunos-api.ts`.
- **Provisório até o login (FE-AUT-01):** a API identifica o profissional pelo header
  `X-Profissional-Id`, preenchido com `VITE_PROFISSIONAL_ID` (ver `.env.example`).
- Validação do formulário em `aluno-validacao.ts`, com as **mesmas regras do back**
  (`apps/api/src/modules/alunos/alunos.schemas.ts`). Mudou lá? Ajuste aqui.
- O link do convite só existe na resposta de gerar/reenviar: aparece uma vez para copiar.

## Erros e validações na tela

| O que aconteceu                                    | Onde aparece                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| Campo inválido (nosso ou recusado pelo back)       | Embaixo do campo, borda vermelha, foco no primeiro com erro + aviso |
| Ação falhou (409, sem conexão, servidor fora…)     | Aviso (toast) com a mensagem da API                                 |
| Tela não carregou                                  | `ErrorState` no lugar do conteúdo (FE-SET-04)                       |
| Ação que não dá para desfazer (revogar, desativar) | Diálogo de confirmação                                              |

Avisos (`useToast()` em `components/feedback/toast.tsx`): sucesso some em 4s; **erro fica**
até fechar, até a próxima ação dar certo ou até sair da tela; título repetido não empilha.
Celular: embaixo (não cobre o campo com erro). Desktop: canto superior direito.

Campos obrigatórios têm `*` vermelho no label e o formulário avisa "Campos com * são obrigatórios".

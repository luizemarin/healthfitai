# @healthfitai/web — Painel do profissional

React + TypeScript (Vite). Base do painel: roteamento, client de API tipado e sessão (FE-SET-01).

## Rodando

```bash
cp apps/web/.env.example apps/web/.env   # opcional: os padrões já funcionam
npm run dev:api                           # API em http://localhost:3333
npm run dev:web                           # painel em http://localhost:5173
```

Em dev, o painel chama `/api/*` e o Vite repassa para a API (sem CORS).

## Estrutura

```
src/
  main.tsx                 sobe o React com o roteador
  config.ts                variáveis de ambiente (VITE_API_URL)
  routes/                  mapa de rotas (router.tsx), layout e páginas
  api/
    client.ts              `api` (com token) e `publicApi` (sem token) + `unwrap`
    api-error.ts           ApiError: formato único de erro para as telas
    generated/schema.ts    tipos gerados do OpenAPI — não editar à mão
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

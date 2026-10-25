# @healthfitai/mobile — App do aluno

React Native + Expo (SDK 58) com TypeScript. Base do app: navegação, client de API tipado e
tokens do design system (MB-SET-01). Estilização com NativeWind (MB-SET-03).

## Rodando

```bash
npm install                 # na raiz do monorepo
npm run dev:api             # API em http://localhost:3333
npm run dev:mobile          # abre o Expo: "i" (iOS), "a" (Android) ou QR code no Expo Go
```

Em dev o app chama a API no **mesmo IP da máquina que roda o Expo**, porta 3333. Funciona no
simulador, no emulador e no celular na mesma rede Wi-Fi, sem configurar nada. Para apontar para
outro servidor, copie `.env.example` para `.env` e preencha `EXPO_PUBLIC_API_URL`.

## Estrutura

```
src/
  app/                     telas (expo-router: cada arquivo é uma rota)
    _layout.tsx            moldura: fontes, splash, sessão, guard de login, ErrorBoundary
    login.tsx              login do aluno (só abre sem sessão)
    index.tsx              área do aluno (só abre com sessão) + Sair
    +not-found.tsx         rota inexistente (ex.: deep link errado)
  auth/
    auth.ts                signIn, signOut, refreshSession (rotas /auth/*)
  session/
    session-store.ts       tokens em memória + armazenamento seguro (expo-secure-store)
    use-session.ts         hook: sessão atual para as telas
  components/
    button.tsx             botão padrão (primary / secondary, loading)
    error-screen.tsx       tela amigável de erro
  config.ts                variáveis de ambiente (EXPO_PUBLIC_API_URL)
  theme/
    tokens.ts              cores, fontes, tamanhos, espaçamentos, raios (fonte do tema)
    global.css             entrada do NativeWind
    fonts.ts               arquivos das fontes (Space Grotesk e Inter)
  api/
    client.ts              `api` (com token e refresh), `publicApi` + `unwrap`
    api-error.ts           ApiError: formato único de erro para as telas
    generated/schema.ts    tipos gerados do OpenAPI — não editar à mão
```

## Navegação

Rotas são arquivos em `src/app`. Uma nova tela é um novo arquivo:

```
src/app/feedbacks/index.tsx   → /feedbacks
src/app/feedbacks/[id].tsx    → /feedbacks/123
```

O `scheme` do app é `healthfitai`, então `healthfitai://feedbacks/123` abre essa tela (base para os
deep links de convite e de feedback).

## Estilização (NativeWind)

Telas são estilizadas com classes Tailwind via [NativeWind](https://www.nativewind.dev) (v4), sem
`StyleSheet.create`:

```tsx
<View className="flex-1 gap-md bg-background p-lg">
  <Text className="font-heading text-xl text-foreground">Título</Text>
  <Pressable className="min-h-12 items-center justify-center rounded-md bg-primary active:opacity-70">
    <Text className="font-body-strong text-md text-primary-foreground">Salvar</Text>
  </Pressable>
</View>
```

O tema vem de `src/theme/tokens.ts` (única fonte de valores), lido por `tailwind.config.ts`. Cores,
fontes, tamanhos de texto e raios **substituem** os do Tailwind: só existe o que é do design
system (não há `bg-red-500`).

| Grupo  | Classes                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| Cores  | `bg-background` `bg-surface` `border-border` `bg-primary` `text-primary-foreground`       |
|        | `text-foreground` `text-foreground-muted`                                                 |
| Fontes | `font-heading` `font-numeric` (Space Grotesk) · `font-body` `font-body-strong` (Inter)    |
| Texto  | `text-xs` `text-sm` `text-md` `text-lg` `text-xl` `text-xxl`                              |
| Espaço | `p-lg` `gap-md` `mt-xl`… (nomes dos tokens) e a escala do Tailwind para tamanhos (`h-12`) |
| Raios  | `rounded-sm` `rounded-md` `rounded-pill`                                                  |

Props que não aceitam classe (cor do `ActivityIndicator`, `placeholderTextColor`, opções do header
do Stack) usam os tokens direto: `colors.textMuted`.

Peças da configuração: `babel.config.js` (JSX com `className`), `metro.config.js` (compila as
classes), `tailwind.config.ts` (tema), `src/theme/global.css` (entrada, importada no `_layout`) e
`src/nativewind-env.d.ts` (tipos do `className`). Ao mexer no tema, reinicie o Expo com cache
limpo: `npx expo start -c`.

## Chamando a API

Os tipos vêm do contrato da API. Quando a API mudar uma rota:

```bash
npm run api:types   # regenera apps/api/openapi.json e os tipos do web e do mobile
```

```ts
import { api, unwrap } from '../api/client';

const feedbacks = await unwrap(api.GET('/feedbacks'));
// erro → lança ApiError { status, code, message, details } (status 0 = sem conexão)
```

## Login e sessão (MB-AUT-02)

- **Tokens no armazenamento seguro**: `expo-secure-store` (Keychain no iOS, Keystore no Android).
  Nunca em AsyncStorage. Ao abrir o app, a sessão salva é carregada antes de esconder a splash.
- **Guard**: o `_layout` usa `Stack.Protected`. Com sessão, só as telas do aluno; sem sessão, só o
  login. Nenhuma tela precisa checar login nem navegar depois de entrar/sair.
- **Renovação**: `api` manda `Authorization: Bearer <accessToken>`. Ao receber 401, troca o
  refresh token por um par novo (uma vez só, mesmo com várias chamadas juntas) e repete a
  requisição. Se o refresh falhar, a sessão é encerrada e o app volta para o login.
- **Logout**: `signOut()` apaga os tokens do aparelho na hora (funciona sem internet) e avisa a API
  para revogar o refresh token.

Contrato usado (provisório até BE-AUT-01 / BE-AUT-03 entrarem no OpenAPI; só `auth/auth.ts` muda):

| Rota                 | Corpo              | Resposta                        |
| -------------------- | ------------------ | ------------------------------- |
| `POST /auth/login`   | `{ email, senha }` | `{ accessToken, refreshToken }` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST /auth/logout`  | `{ refreshToken }` | —                               |

## Erros de carregamento

O aluno nunca vê tela branca nem mensagem técnica (o detalhe vai para o console):

- **Tela que quebra ao renderizar** → `ErrorBoundary` exportado no `_layout` (vale para todas as
  rotas) mostra `ErrorScreen` com "Tentar novamente".
- **Fontes do tema não carregam** → `ErrorScreen` "Não conseguimos abrir o app", e o botão
  reinicia o app.
- `ErrorScreen` usa só a fonte do sistema e componentes nativos, para funcionar justamente quando o
  resto falhou.

## Qualidade

```bash
npm run typecheck -w @healthfitai/mobile
npm run lint -w @healthfitai/mobile
npm run doctor -w @healthfitai/mobile    # confere versões das libs nativas com o SDK do Expo
```

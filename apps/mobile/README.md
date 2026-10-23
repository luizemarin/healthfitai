# @healthfitai/mobile — App do aluno

React Native + Expo (SDK 58) com TypeScript. Base do app: navegação, client de API tipado e
tokens do design system (MB-SET-01).

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
    _layout.tsx            moldura: fontes, splash, Stack com o tema
    index.tsx              tela inicial
    +not-found.tsx         rota inexistente (ex.: deep link errado)
  config.ts                variáveis de ambiente (EXPO_PUBLIC_API_URL)
  theme/
    tokens.ts              cores, fontes, tamanhos, espaçamentos, raios
    fonts.ts               arquivos das fontes (Space Grotesk e Inter)
  api/
    client.ts              `api` + `unwrap`
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

## Design system

Telas usam só os tokens, nunca valores soltos:

```tsx
import { colors, fonts, fontSizes, spacing } from '../theme/tokens';

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.heading, fontSize: fontSizes.xl },
  card: { backgroundColor: colors.surface, padding: spacing.md },
});
```

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

Token e renovação de sessão entram com o login (MB-AUT-02).

## Qualidade

```bash
npm run typecheck -w @healthfitai/mobile
npm run lint -w @healthfitai/mobile
npm run doctor -w @healthfitai/mobile    # confere versões das libs nativas com o SDK do Expo
```

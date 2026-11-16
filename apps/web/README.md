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
    questionarios/         modelos, construtor de perguntas e anamnese respondida (FE-QST-01..03)
    avaliacoes/            preenchimento e histórico das avaliações físico-posturais (FE-AVA-01..02)
    treinos/               montagem, edição e duplicação de treinos do aluno (FE-TRE-01)
    dashboard/             frequência e progresso: visão consolidada dos alunos e detalhe (FE-DSH-01)
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

## Questionários (FE-QST-01..03)

| Rota                         | Tela                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| `/questionarios`             | Modelos: busca, filtros de tipo e situação, paginação (filtros na URL) |
| `/questionarios/novo?tipo=…` | Criar modelo (o tipo vem do filtro da lista, se houver)                |
| `/questionarios/:id`         | Editar modelo — ou só ver, se for padrão do sistema ou estiver inativo |
| `/alunos/:id?aba=anamnese`   | Anamneses respondidas pelo aluno, por data (FE-QST-03)                 |

- Chamadas à API só em `features/questionarios/questionarios-api.ts`.
- **Gestão (FE-QST-01):** duplicar abre a cópia para editar; desativar pede confirmação e não apaga nada.
  Modelo **padrão** do sistema é só leitura: tem "Ver" e "Duplicar". Modelo **inativo**: "Ver" e "Ativar".
- **Construtor (FE-QST-02):** adicionar, remover e ordenar (↑ ↓) perguntas; tipo, obrigatória e, em
  número/escala, unidade, mínimo/máximo e "Exibir no gráfico de evolução". A ordem da lista é a ordem
  do formulário do aluno. Opções de escolha: uma por linha.
- Validação em `modelo-validacao.ts`, com as **mesmas regras do back**
  (`apps/api/src/modules/questionarios/questionarios.schemas.ts`). Mudou lá? Ajuste aqui.
  Erros do back por pergunta (`body.perguntas.2.enunciado`) vão para o campo certo.
- Editar envia a `versao` aberta: se outra pessoa salvou antes, o back recusa (409) e a mensagem dele
  aparece no aviso. Mudar as perguntas cria uma versão nova; as respostas antigas ficam na versão delas.
- **Anamnese respondida (FE-QST-03):** lista por data (mais recente primeiro) com modelo e versão; ao abrir,
  as perguntas aparecem como estavam na versão respondida (`?resposta=<id>` na URL).
- Erros: quando o back manda uma mensagem pensada para o usuário (4xx), ela é usada no aviso e na tela de
  erro (`mensagemDaApi`/`avisarErro`); sem conexão, sessão expirada e servidor fora usam o texto padrão.
  Se as cores não carregarem, vale o aviso geral do painel (ThemeNotice) e as telas seguem legíveis.

## Avaliações (FE-AVA-01..02)

| Rota                          | Tela                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `/alunos/:id/avaliacoes/nova` | Preencher avaliação físico-postural (FE-AVA-01)             |
| `/alunos/:id?aba=avaliacoes`  | Histórico e comparação das avaliações, por data (FE-AVA-02) |

- Chamadas à API só em `features/avaliacoes/avaliacoes-api.ts`. A avaliação usa o motor de questionários:
  modelo do tipo `avaliacao` (o padrão traz os 5 testes — BE-QST-06), preenchido pelo profissional (BE-RSP-03).
- **Preenchimento (FE-AVA-01):** escolhe o modelo ativo (se houver mais de um) e "Começar avaliação" — se já
  existir rascunho daquele modelo, o back devolve o mesmo, com as respostas já salvas. Data da avaliação:
  hoje por padrão, não aceita futuro. Ao registrar, vira registro final, datado e imutável.
- Cada tipo de pergunta vira o campo certo (`campo-pergunta.tsx`): escolha única/sim-não em opções,
  múltipla escolha em caixas de marcar, número/escala com mínimo/máximo/unidade, texto e data.
- Erros do back vão para o campo certo: obrigatória pendente (`perguntas.<id>`), valor inválido
  (`body.respostas.<i>.valor`) e data (`body.respondidoEm`). Aluno inativo e avaliação já enviada
  mostram a mensagem do back no aviso.
- **Histórico (FE-AVA-02):** lista por data (mais recente primeiro); marque as avaliações para comparar
  lado a lado — uma linha por teste, colunas da mais antiga para a mais nova. Abre com as duas mais
  recentes marcadas. Entre versões do modelo, o mesmo teste é ligado pelo enunciado; teste que não
  existia naquela versão aparece como "Não avaliado".

## Fotos (FE-FOT-01..03)

| Rota                    | Tela                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `/fotos/poses`          | Poses que o app pede ao aluno, na ordem: adicionar e remover (FE-FOT-01)  |
| `/alunos/:id?aba=fotos` | Comparador antes/depois (FE-FOT-03) e galeria por data e pose (FE-FOT-02) |

- Chamadas à API só em `features/fotos/fotos-api.ts` (BE-FOT-01 e BE-FOT-04).
- **Poses (FE-FOT-01):** na primeira vez o back cria as padrão (Frente, Perfil e Costas). A pose nova entra
  no fim. Remover pede confirmação e não apaga nada: a pose some do app e as fotos antigas ficam.
  Nome repetido, limite de poses e "última pose ativa" mostram a mensagem do back no aviso.
- **Galeria (FE-FOT-02):** dias com fotos, do mais recente ao mais antigo; no dia, uma miniatura por pose.
  Paginação por data (100 dias por página).
- **Comparador (FE-FOT-03):** aparece com fotos em pelo menos duas datas. Abre com a data mais antiga
  (antes) e a mais recente (depois), escolhidas entre as datas da galeria; botões trocam a pose e o slider
  move a divisão entre as fotos sobrepostas. Pose sem foto numa das datas mostra só a que existe.
- **Fotos que não abrem:** as URLs são assinadas e expiram em minutos. Se uma imagem falhar, aparece
  "Não foi possível exibir a foto" com "Recarregar fotos" (busca URLs novas) no lugar da imagem quebrada.
- `Comparacao` é tipada à mão em `fotos-api.ts`: o gerador transforma a foto `null` em um tipo impossível.

## Treinos (FE-TRE-01)

| Rota                            | Tela                                        |
| ------------------------------- | ------------------------------------------- |
| `/alunos/:id?aba=treinos`       | Treinos do aluno: montar, editar e duplicar |
| `/alunos/:id/treinos/novo`      | Montar treino (editor)                      |
| `/alunos/:id/treinos/:treinoId` | Editar treino (mesmo editor)                |

- Chamadas à API só em `features/treinos/treinos-api.ts` (BE-TRE-01).
- **Editor:** nome + exercícios na ordem em que o aluno vai fazer (↑ ↓ para mudar a ordem). Cada exercício
  tem séries, repetições, descanso (segundos) e carga (kg, opcional — vazio = sem carga). Os exercícios vêm
  da biblioteca (FE-EXE-01) pela busca "Adicionar exercício"; cada um entra uma vez só no treino.
- Salvar a edição envia a lista inteira (o back substitui). Os treinos já feitos pelo aluno não mudam.
- Exercício excluído da biblioteca depois aparece com a etiqueta "Excluído da biblioteca": remova-o
  antes de salvar ou duplicar (o back recusa e explica).
- **Duplicar:** cria a cópia para o mesmo aluno ("<nome> (cópia)") e já abre ela no editor.
- Validação em `treino-validacao.ts`, com as **mesmas regras do back**
  (`apps/api/src/modules/treinos/treinos.schemas.ts`). Mudou lá? Ajuste aqui.
  Erros do back por exercício (`body.exercicios.2.series`) vão para o campo certo; aluno inativo e
  treino com exercício excluído mostram a mensagem do back no aviso.
- Se a lista, o treino ou a biblioteca não carregarem, aparece o `ErrorState` com mensagem amigável
  (ou a do back, quando é para o usuário) e "Tentar novamente". Se as cores não carregarem, vale o aviso
  geral do painel (ThemeNotice) e as telas seguem legíveis nas cores do sistema.

## Dashboard (FE-DSH-01)

| Rota                    | Tela                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `/dashboard`            | Visão consolidada: frequência de cada aluno no período (filtros na URL) |
| `/dashboard/alunos/:id` | Detalhe do aluno: frequência, treinos por semana e progressão de carga  |

- Chamadas à API só em `features/dashboard/dashboard-api.ts` (BE-DSH-01). Os números vêm prontos do back
  (só treinos finalizados contam); a tela só formata.
- **Visão consolidada:** busca pelo nome, situação (ativos — padrão do back — ou inativos), ordenação
  (nome, treinos, último treino) e paginação. Cada card mostra treinos, dias treinados, média semanal,
  último treino e dias sem treinar, e abre o detalhe no mesmo período.
- **Período:** "De" e "Até" vazios = últimos 30 dias (padrão do back). O período usado aparece acima da lista.
  Data no futuro, "De" depois de "Até" ou período longo demais: o back recusa e a mensagem dele aparece
  embaixo do campo, com "Usar últimos 30 dias" (sem "Tentar novamente", que não resolveria).
- **Detalhe:** barras de treinos por semana (todas as semanas do período, inclusive com 0) e uma linha por
  exercício com carga inicial, atual e variação; "Cargas por dia" mostra a maior carga de cada dia.
  Exercício excluído da biblioteca aparece com a etiqueta "Excluído da biblioteca".
- Se a visão ou o detalhe não carregarem, aparece o `ErrorState` com mensagem amigável (ou a do back,
  quando é para o usuário — ex.: "Aluno não encontrado.") e "Tentar novamente". Se as cores não carregarem,
  vale o aviso geral do painel (ThemeNotice) e as telas seguem legíveis nas cores do sistema.

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

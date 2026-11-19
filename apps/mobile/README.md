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
    anamnese.tsx           preenchimento da anamnese com autosave (MB-ANA-01/02)
    feedbacks/
      index.tsx            lista de feedbacks por status (MB-FBK-01)
      [id].tsx             responder (MB-FBK-02) ou ver comentários (MB-FBK-03); abre pelo link do e-mail
    fotos/
      enviar.tsx           envio de fotos por pose (MB-FOT-01)
      index.tsx            galeria por data + antes/depois (MB-FOT-02)
    evolucao/
      registrar.tsx        registrar peso e medidas de hoje (MB-EVO-01)
      index.tsx            gráficos de peso, medidas e perguntas flagadas (MB-EVO-02)
    treinos/
      index.tsx            treinos ativos do aluno (entrada da execução)
      [id].tsx             execução: exercícios, timer no header, "Finalizar treino" (MB-TRE-01/02)
      evolucao.tsx         frequência semanal e progressão de carga por exercício (MB-EVO-03)
    nutricao.tsx           plano nutricional em uso, refeições na ordem do dia (MB-NUT-01)
    +not-found.tsx         rota inexistente (ex.: deep link errado)
  questionario/            motor comum de anamnese e feedback (mesmas rotas de submissões no back)
    submissoes-api.ts      abrir, autosave, enviar + identificação do aluno (PROVISÓRIO)
    use-questionario.ts    regra do preenchimento: abrir, autosave, enviar
    formulario.tsx         tela do preenchimento (perguntas, status do autosave, botões)
    campo-pergunta.tsx     uma pergunta por tipo (texto, escolha, sim/não, número, escala, data)
    valores.ts             valor da tela ↔ valor da API (ex.: "72,5" → 72.5, DD/MM/AAAA → AAAA-MM-DD)
    erros.ts               mensagem para o aluno e erro do back → pergunta certa
    rascunho-local.ts      cópia do rascunho no aparelho (expo-file-system)
  anamnese/
    anamnese-api.ts        abre a anamnese (modelo pelo sexo do aluno)
    use-anamnese.ts        o que é próprio da anamnese (nome, arquivo do rascunho, mensagens)
  feedbacks/
    feedbacks-api.ts       lista e detalhe dos feedbacks
    use-feedbacks.ts       lista por status, "Ver mais", recarrega ao voltar à tela
    use-feedback.ts        um feedback (pela lista ou pelo link do e-mail)
    comentarios.tsx        comentários do treinador
    status-feedback.tsx    selo do status (Pendente, Atrasado, Respondido)
    feedback-formato.ts    textos, seções e validação do id do link
  fotos/
    fotos-api.ts           poses, envio em 2 passos, galeria e comparação
    escolher-foto.ts       câmera/galeria, permissão da câmera e conversão para JPEG
    enviar-foto.ts         envio (URL assinada → PUT no storage → confirmar) com retentativa
    use-envio-fotos.ts     estado de cada pose na tela de envio
    use-galeria.ts         galeria (recarrega ao voltar à tela) e comparação antes/depois
    comparador.tsx         escolha das datas e fotos lado a lado por pose
    foto-imagem.tsx        foto do storage com aviso amigável se a URL expirar
    fotos-formato.ts       mensagens para o aluno e regra de "tentar de novo"
  evolucao/
    evolucao-api.ts        tipos de medida, registrar peso/medidas e séries de evolução
    use-registro.ts        formulário rápido: conferir, enviar peso e medidas, erros por campo
    use-evolucao.ts        séries dos gráficos (recarrega ao voltar à tela)
    grafico-linha.tsx      gráfico de linha de uma série (react-native-svg)
    evolucao-formato.ts    mensagens para o aluno, leitura do número digitado, valor com unidade
  treinos/
    treinos-api.ts         lista, detalhe, "Finalizar treino" e evolução do treino
    use-treinos.ts         lista dos treinos (recarrega ao voltar à tela)
    use-execucao.ts        regra da execução: séries feitas, descanso, timer e envio
    cartao-exercicio.tsx   um exercício da lista: prescrição e uma linha por série
    timer-pill.tsx         timer do treino em pill (header)
    relogio.ts             "agora" a cada segundo e segundos entre dois instantes
  nutricao/
    nutricao-api.ts        plano nutricional em uso do aluno
    use-plano.ts           plano em uso (recarrega ao voltar à tela); sem plano = estado vazio
    nutricao-formato.ts    mensagem padrão e código do "sem plano"
    use-evolucao-treino.ts frequência e progressão de carga (recarrega ao voltar à tela)
    frequencia-semanal.tsx barras de treinos por semana
    treinos-formato.ts     mensagens para o aluno, MM:SS, prescrição e leitura das repetições, "N treinos"
  utils/
    datas.ts               DD/MM/AAAA e HH:MM montados à mão (iguais no iOS e no Android)
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
|        | `text-foreground` `text-foreground-muted` `text-danger` (erros e alertas)                 |
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

## Anamnese (MB-ANA-01 / MB-ANA-02)

Tela `/anamnese` (botão "Preencher anamnese" no início). Fluxo:

A regra do preenchimento fica em `questionario/` e é a mesma do feedback; a anamnese só informa o
que é dela (`anamnese/use-anamnese.ts`).

1. **Abrir**: `GET /alunos/:alunoId/anamnese/modelo` (a API escolhe o modelo pelo sexo do aluno) e
   `POST /alunos/:alunoId/submissoes`, que abre o rascunho ou **retoma o que já estava aberto**,
   com as respostas salvas.
2. **Preencher**: as perguntas são desenhadas pelo tipo (BE-QST-02). Escolhas, sim/não e escala
   curta (até 11 valores) são botões; número usa teclado decimal (aceita vírgula ou ponto); data é
   digitada como DD/MM/AAAA com as barras automáticas.
3. **Autosave**: cada alteração é guardada **no aparelho na hora** e enviada ao servidor
   (`PATCH .../submissoes/:id`, só as perguntas alteradas) 1,5 s depois da última alteração. Também
   salva ao ir para segundo plano, ao sair da tela e em "Salvar e continuar depois". O topo mostra
   "Rascunho salvo automaticamente às HH:MM" ou, na falha, o aviso com "Tentar salvar agora".
4. **Retomar**: ao abrir de novo, o que estava no aparelho e não chegou ao servidor volta para a
   tela e é salvo.
5. **Enviar**: `POST .../finalizar` com o que faltava salvar. Obrigatórias e formatos são
   conferidos pelo back; a mensagem dele aparece embaixo da pergunta e a tela rola até a primeira.

**No aparelho** fica só o que o servidor ainda não confirmou, num arquivo JSON na pasta de
documentos do app (área privada, mesma API no iOS e no Android). Sem pendências ou depois de
enviar, o arquivo é apagado.

**Mensagens**: as do back são usadas como vêm (ex.: "Pergunta 2: Responda com um número."). As
escritas para o profissional viram frases para o aluno (`ANAMNESE_NAO_DISPONIVEL`, `ALUNO_INATIVO`,
`MODELO_INATIVO` → "…Avise seu treinador."). Sem conexão e falha do servidor nunca mostram texto
técnico.

**iOS e Android iguais** (vale também para o feedback, que usa o mesmo formulário): nada de seletores nativos (radio, checkbox, date picker), que mudam de um
sistema para o outro; o campo multilinha começa no topo nos dois; o botão de voltar mostra só a
seta; arrastar a lista fecha o teclado (o numérico do iOS não tem botão de fechar); qualquer saída
de "active" salva (o iOS passa por "inactive", o Android não); a hora do autosave é montada à mão,
sem depender do `Intl`.

**Identificação do aluno (PROVISÓRIO)**: a API ainda não lê o aluno do token, então as rotas pedem
o id do aluno na URL e o do profissional no header `X-Profissional-Id`, como o painel web faz hoje
(vale para anamnese e feedbacks).
Configure no `.env`:

```bash
EXPO_PUBLIC_ALUNO_ID=<id do aluno>          # cadastre no painel web e copie o id da URL /alunos/<id>
EXPO_PUBLIC_PROFISSIONAL_ID=                # vazio em dev = mesmo id padrão do painel web
```

Sem `EXPO_PUBLIC_ALUNO_ID`, a tela mostra "Não encontramos seu cadastro neste aparelho". Quando o
login do aluno trouxer esses dados (BE-AUT-01), só `identificacaoDoAluno()` em
`questionario/submissoes-api.ts` muda.

## Feedbacks (MB-FBK-01 / MB-FBK-02 / MB-FBK-03)

Botão "Meus feedbacks" no início.

- **Lista** (`/feedbacks`, MB-FBK-01): três seções com o total de cada uma: **Pendentes** (o back
  chama de `enviado`), **Atrasados** e **Respondidos**. `agendado` ainda não saiu para o aluno e
  não aparece. Cada seção traz 20 por vez (`GET /alunos/:alunoId/feedbacks?status=…`, mais
  recentes primeiro) com "Ver mais". Cada item mostra o modelo, a data (recebido/respondido) e
  quantos comentários o treinador fez. A lista recarrega sempre que a tela volta ao foco (ex.:
  depois de responder); se essa recarga falhar, a lista que estava na tela continua.
- **Responder** (`/feedbacks/:id`, MB-FBK-02): pendente ou atrasado abre o formulário direto. É o
  mesmo da anamnese (autosave, rascunho no aparelho, mensagens do back embaixo da pergunta), com o
  modelo do feedback: `POST /alunos/:alunoId/submissoes { modeloId }` abre ou retoma o rascunho,
  depois `PATCH` e `.../finalizar`. Rascunho no aparelho: `feedback-rascunho-<id>.json`.
- **Link do e-mail**: `healthfitai://feedbacks/<id>` abre a mesma tela (expo-router). Id que não é
  UUID nem vai à API: "Este link de feedback não é válido." Feedback ainda `agendado`: "Este
  feedback ainda não foi liberado para resposta."
- **Comentários** (MB-FBK-03): feedback respondido mostra a data da resposta e os comentários do
  treinador, do mais antigo ao mais novo, com data e hora; sem comentários, "Seu treinador ainda
  não comentou este feedback." (o back só aceita comentário depois da resposta).

**iOS e Android iguais**: o formulário é o da anamnese (mesmos cuidados, abaixo); datas
DD/MM/AAAA e horas montadas à mão (sem `Intl`); as listas não usam `SectionList` (cabeçalho fixo no
iOS e solto no Android por padrão) nem ajuste automático de conteúdo do iOS; botão de voltar só com a
seta; espaço da barra de gestos pelo inset nos dois.

**Mensagens**: as do back vão como vêm (ex.: "Feedback não encontrado.", "Responda as perguntas
obrigatórias antes de enviar (2 pendente(s))."). As escritas para o profissional viram frases para
o aluno (`ALUNO_INATIVO`, `MODELO_INATIVO` → "…Fale com seu treinador.").

**Status respondido** (BE-FBK-04): o envio manda `feedbackId` no `.../finalizar`. O back confere
antes (feedback do aluno, do mesmo modelo, esperando resposta) e, depois de enviar, o feedback passa
a "Respondido" ligado à submissão. Erros vêm do back como estão: "Este feedback já foi respondido.",
"Este feedback ainda não foi liberado para resposta.".

**Pendências fora do app**:

- Os feedbacks só existem depois que o job de liberação (BE-FBK-02) os cria; até lá a lista fica
  vazia. O e-mail desse job deve apontar para `healthfitai://feedbacks/<id>`.
- Sem sessão, o link abre o login (guard do `_layout`) e, depois de entrar, o app vai para o
  início, não para o feedback.

## Fotos (MB-FOT-01 / MB-FOT-02)

Botões "Enviar fotos" e "Minhas fotos" no início (a galeria também tem "Enviar fotos").

- **Envio por pose** (`/fotos/enviar`, MB-FOT-01): as poses vêm do treinador
  (`GET /poses?ativa=true`, BE-FOT-01), na ordem dele. Cada pose é um cartão com o guia
  "Pose 1 de 3 · Frente" e os botões **Tirar foto** (câmera) e **Escolher da galeria**. A foto sobe
  na hora, nos 2 passos do BE-FOT-02: `POST /alunos/:alunoId/fotos/envios` (URL assinada) → `PUT`
  do arquivo direto no storage → `POST /alunos/:alunoId/fotos` (confirma; a API processa e cria a
  foto). A data é a de hoje (a API decide, horário de Brasília). Enviar de novo a mesma pose cria
  outra foto (nada é sobrescrito); no antes/depois vale a mais recente do dia.
- **Retentativa**: cada passo tenta de novo sozinho em falha passageira (sem conexão, servidor ou
  storage fora): 3 tentativas, com 1 s e 3 s de espera. Se ainda falhar, o cartão mostra a mensagem
  e **Tentar de novo**, que reenvia a mesma foto (sem tirar outra) com um envio novo. Foto recusada
  pelo back (grande demais, inválida) não tem "Tentar de novo": o aluno tira ou escolhe outra.
- **Permissões**: só a câmera pede permissão. Negada uma vez, o cartão de aviso explica e o
  aluno pode escolher da galeria; quando o sistema não pergunta mais, aparece **Abrir ajustes**
  (`Linking.openSettings`, igual nos dois). Os textos da permissão estão no `app.json` (plugin
  `expo-image-picker`); o microfone fica bloqueado (não gravamos vídeo).
- **Galeria** (`/fotos`, MB-FOT-02): `GET /alunos/:alunoId/fotos`, agrupada por data (mais
  recentes primeiro) e, no dia, pela ordem das poses, 3 miniaturas por linha. 100 dias por página
  com "Ver mais". Recarrega sempre que a tela volta ao foco (ex.: depois de enviar), o que também
  renova as URLs assinadas.
- **Antes/depois** (MB-FOT-02): com fotos em 2 datas ou mais, escolhe "Antes" e "Depois" (começa
  na mais antiga × mais recente, como no painel) e vê, pose a pose, as duas fotos lado a lado
  (`GET /alunos/:alunoId/fotos/comparar`). Pose sem foto numa das datas mostra "Sem foto desta pose
  nesta data.".

**iOS e Android iguais**: sem a tela de recorte (`allowsEditing`), que é diferente em cada sistema;
toda foto é convertida para **JPEG** antes de subir (a galeria do iPhone guarda em HEIC, a do Android
pode ter PNG/WebP), então o envio é o mesmo nos dois e sempre num tipo aceito pela API; a galeria usa
o seletor do sistema, que não pede permissão nos dois (iOS 14+ / Android 13+); datas escolhidas em
botões, não no seletor nativo; imagens sem o fade de 300 ms que só o Android faz; linha de datas sem
o "pulo" do iOS nem o brilho do Android no fim; botão de voltar só com a seta.

**Mensagens**: as do back vão como vêm (ex.: "A foto deve ter no máximo 10 MB.", "Não foi possível
ler a imagem: o arquivo parece estar incompleto ou corrompido."). As escritas para o profissional
viram frases para o aluno (`POSE_INATIVA`, `ENVIO_NAO_ENCONTRADO`, `SEM_FOTOS_NA_DATA`,
`ALUNO_INATIVO`). Sem conexão e falha do servidor/storage (503) nunca mostram texto técnico.

**Pendências fora do app**:

- `criadoPor` da foto ainda sai "profissional": a API só identifica o aluno com o login (BE-AUT).
- Regras de fotos para menores (LG-MEN-06) são um requisito à parte e não estão aqui.
- Android pode encerrar o app enquanto a câmera está aberta (pouca memória); nesse caso a foto
  tirada se perde e o aluno tira de novo (o `getPendingResultAsync` do expo-image-picker não foi
  usado para manter o fluxo simples e igual ao iOS).

## Evolução (MB-EVO-01 / MB-EVO-02)

Botões "Registrar peso e medidas" e "Minha evolução" no início (a evolução também tem "Registrar
peso e medidas").

- **Registrar peso e medidas** (`/evolucao/registrar`, MB-EVO-01): formulário rápido, uma tela só.
  Campo de peso (kg) e um campo por medida pedida pelo treinador (`GET /tipos-medida?ativo=true`,
  BE-MED-02), na ordem dele e com a unidade de cada uma. O aluno preenche só o que mediu; a data é
  a de hoje (a API decide, horário de Brasília). "Salvar" envia o peso (`POST
/alunos/:alunoId/pesos`) e as medidas preenchidas de uma vez (`POST /alunos/:alunoId/medidas`).
  Nada é sobrescrito (BE-MED-01): registrar de novo no mesmo dia cria outro registro, e no gráfico
  vale o mais recente do dia.
- **Falha só de uma parte**: peso e medidas são rotas separadas. O que foi salvo sai da tela
  ("O peso foi registrado. …") e só o que falhou fica preenchido para tentar de novo, sem registrar
  duas vezes. As medidas entram todas ou nenhuma (regra do back).
- **Conferência**: no app, só se o texto é um número (aceita vírgula ou ponto) e se algo foi
  preenchido. Limites e casas decimais são do back, e a mensagem dele aparece embaixo do campo
  certo (`body.pesoKg`, `body.medidas.<i>.valor`), ex.: "O peso deve ser maior que zero.",
  "\"Gordura corporal\" é medido em % e deve ser de no máximo 100.".
- **Gráficos** (`/evolucao`, MB-EVO-02): `GET /alunos/:alunoId/evolucao` (BE-EVO-01), desde o
  primeiro registro. Um gráfico de linha para o **peso**, um para cada **medida** e um para cada
  **pergunta flagada** (BE-QST-03) com o nome do questionário embaixo do título. Cada um mostra o
  último valor e a data, os valores máximo e mínimo do eixo e as datas do primeiro e do último
  ponto. O eixo X respeita a distância entre as datas; pergunta com limites (ex.: escala de 0 a 10)
  usa esses limites no eixo Y. A tela recarrega sempre que volta ao foco (ex.: depois de
  registrar); se essa recarga falhar, os gráficos que estavam na tela continuam.

**iOS e Android iguais**: os gráficos são desenhados com `react-native-svg` (mesmo desenho nos
dois); os textos ficam em `<Text>` fora do SVG para usar as fontes do tema nos dois; a largura é
medida na tela (`onLayout`), não pelo tamanho da janela; datas DD/MM/AAAA e números com vírgula
montados à mão (sem `Intl`); o eixo X conta os dias em UTC, sem o fuso do aparelho; teclado
`decimal-pad` (existe nos dois) aceitando vírgula ou ponto; arrastar a tela fecha o teclado (o
numérico do iOS não tem botão de fechar); a tela sobe com o teclado como no login; leitor de tela
(VoiceOver e TalkBack) lê cada gráfico como um resumo único; botão de voltar só com a seta.

**Mensagens**: as do back vão como vêm. As escritas para o profissional viram frases para o aluno
(`TIPO_MEDIDA_INATIVO` → "Uma das medidas não é mais pedida pelo seu treinador…", `ALUNO_INATIVO`).
Sem conexão e falha do servidor nunca mostram texto técnico.

**Pendências fora do app**:

- `registradoPor` do peso e das medidas ainda sai "profissional": a API só identifica o aluno com o
  login (BE-AUT).
- Consentimento para dados de saúde (LG-CON-01) é um requisito à parte e não está aqui.

## Treinos (MB-TRE-01 / MB-TRE-02)

Botão "Meus treinos" no início.

- **Treinos** (`/treinos`): os treinos ativos montados pelo treinador
  (`GET /alunos/:alunoId/treinos`, BE-TRE-01), com o número de exercícios. Tocar abre a execução.
  Recarrega sempre que a tela volta ao foco; se essa recarga falhar, a lista que estava na tela
  continua.
- **Execução** (`/treinos/:id`, MB-TRE-01): `GET /treinos/:id`. **Lista vertical** de todos os
  exercícios, na ordem do treinador; cada cartão mostra "Exercício 1 de 5 · grupo", o nome e o que
  foi pedido ("4 séries de 8-12 · 40 kg · descanso 01:30"). **Timer em pill no header**: começa
  quando o treino abre e para ao finalizar (MM:SS; H:MM:SS a partir de 1 hora). **Botão fixo
  "Finalizar treino"** no rodapé, fora da rolagem.
- **Séries** (MB-TRE-02): uma linha por série com **repetições** e **carga (kg)** e a caixa
  **Feita**. O que o treinador pediu aparece como dica no campo vazio. Ao marcar como feita, o app
  confere só se as repetições são um número inteiro e a carga um número (vírgula ou ponto; vazio =
  sem carga). Tocar de novo desmarca. Valores continuam editáveis depois de marcar.
- **Descanso** (MB-TRE-02): ao marcar uma série como feita, se o treinador pediu descanso, o
  rodapé mostra quanto falta ("Descanso 01:12"); zerado, mostra "Descanso concluído · próxima série"
  e passa a contar o tempo total. O descanso **feito** é guardado na série quando o aluno toca
  "Encerrar" ou marca a próxima série (até 30 min, o limite do back). Descanso aberto ao finalizar
  não conta.
- **Finalizar**: `POST /treinos/:treinoId/execucoes` (BE-TRE-02) com o início, a duração do timer e
  as séries **marcadas como feitas** (repetições, carga e descanso). Sem nenhuma feita: "Conclua pelo
  menos uma série antes de finalizar o treino.". Deu certo: "Treino registrado" com o nome, o tempo
  e quantas séries entraram.
- **Falha ao finalizar**: nada sai da tela, o timer volta a correr e a mensagem fica acima do
  botão. Reenviar usa o **mesmo início**, então o back não registra duas vezes: se o primeiro envio
  tinha chegado (ex.: a resposta se perdeu), o back responde `EXECUCAO_JA_REGISTRADA` e o app mostra
  "Treino registrado" com a mensagem dele. Erro de uma série (`body.series.<i>.*`) aparece embaixo
  da série certa, ex.: "A \"cargaKg\" deve ser de no máximo 1000 kg.".

**iOS e Android iguais**: os tempos são sempre "agora − início" (não um contador somado), então
com o app em segundo plano — o iOS pausa o JavaScript, o Android nem sempre — o timer e o descanso
estão certos ao voltar; `MM:SS` montado à mão (sem `Intl`); pill com largura mínima (não "pula"
quando os dígitos mudam); a caixa "Feita" é desenhada (não o checkbox nativo); teclados `number-pad`
e `decimal-pad` (existem nos dois); arrastar a lista fecha o teclado (o numérico do iOS não tem botão
de fechar) e tocar em "Feita" com o teclado aberto já marca; a tela sobe com o teclado como no login;
rodapé com o espaço da barra de gestos pelo inset nos dois; botão de voltar só com a seta.

**Mensagens**: as do back vão como vêm (ex.: "Treino não encontrado.", "O início do treino não pode
ser no futuro. Confira a data e a hora do celular."). As escritas para o profissional viram frases
para o aluno (`EXERCICIO_NAO_ENCONTRADO`, `ALUNO_INATIVO`). Sem conexão e falha do servidor nunca
mostram texto técnico.

**Pendências fora do app**:

- O que foi anotado fica só na memória da tela: sair do treino antes de finalizar (ou o sistema
  encerrar o app) perde as anotações. Guardar no aparelho e enviar depois é do MB-NFR-01 (offline).
- `GET /treinos/:id` ainda confere só o profissional, não o aluno: a API só identifica o aluno com o
  login (BE-AUT).
- A lista traz até 100 treinos (máximo da API por página).

## Erros de carregamento

O aluno nunca vê tela branca nem mensagem técnica (o detalhe vai para o console):

- **Tela que quebra ao renderizar** → `ErrorBoundary` exportado no `_layout` (vale para todas as
  rotas) mostra `ErrorScreen` com "Tentar novamente".
- **Anamnese quebra ao renderizar** → `ErrorBoundary` próprio da rota: "Não conseguimos abrir a
  anamnese. O que você já respondeu ficou guardado." (o rascunho continua no aparelho).
- **Anamnese não carrega** (sem internet, API fora, anamnese indisponível) → `ErrorScreen` com a
  mensagem do back (ou a amigável) e "Tentar novamente".
- **Feedbacks**: lista e feedback têm `ErrorBoundary` próprio ("Não conseguimos abrir seus
  feedbacks" / "…o feedback"); falha ao carregar → `ErrorScreen` com a mensagem do back (ou a
  amigável) e "Tentar novamente"; falha no "Ver mais" aparece embaixo da seção, sem perder a lista.
- **Fotos**: envio e galeria têm `ErrorBoundary` próprio ("Não conseguimos abrir o envio de
  fotos" / "…suas fotos"); falha ao carregar poses ou galeria → `ErrorScreen` com a mensagem do back
  (ou a amigável) e "Tentar novamente"; foto que não abre (URL expirada, storage fora) mostra "Não
  foi possível exibir a foto." com "Recarregar fotos", no lugar da imagem quebrada.
- **Evolução**: registro e gráficos têm `ErrorBoundary` próprio ("Não conseguimos abrir o
  registro de peso e medidas" / "…sua evolução"); falha ao carregar as medidas ou as séries →
  `ErrorScreen` com a mensagem do back (ou a amigável) e "Tentar novamente"; falha ao salvar
  aparece acima do botão "Salvar", sem perder o que foi digitado.
- **Treinos**: lista e execução têm `ErrorBoundary` próprio ("Não conseguimos abrir seus
  treinos" / "…o treino"); falha ao carregar → `ErrorScreen` com a mensagem do back (ou a amigável)
  e "Tentar novamente"; link com id inválido mostra "Treino não encontrado." sem ir à API; falha ao
  finalizar aparece acima do botão "Finalizar treino", sem perder o que foi anotado.
- **Cores do tema**: vêm de `theme/tokens.ts` e são compiladas no app pelo NativeWind (não são
  baixadas), então não falham ao abrir. As cores dos gráficos são os mesmos tokens, passados
  direto ao SVG. O que carrega em tempo de execução são as fontes (abaixo).
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

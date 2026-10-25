import { useEffect, useState } from 'react';

import { reloadAppAsync } from 'expo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ErrorScreen } from '../components/error-screen';
import { sessionStore } from '../session/session-store';
import { useSession } from '../session/use-session';
import { fontAssets } from '../theme/fonts';
import '../theme/global.css';
import { colors, fonts } from '../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

// Mantém a splash até fontes e sessão carregarem (evita piscar a tela de login à toa).
preventAutoHideAsync().catch(() => {
  // Splash já escondida (ex.: fast refresh): nada a fazer.
});

function hideSplash(): void {
  hideAsync().catch(() => {});
}

function restartApp(): void {
  reloadAppAsync().catch(() => {});
}

/**
 * Qualquer tela que quebrar ao renderizar cai aqui (expo-router usa este export como
 * error boundary de todas as rotas): o aluno vê a mensagem amigável, nunca uma tela branca.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[tela] Falha ao renderizar.', error);
    hideSplash(); // se o erro veio antes da splash sumir, ela esconderia a mensagem
  }, [error]);

  return (
    <>
      <StatusBar style="light" />
      <ErrorScreen
        onRetry={() => {
          retry().catch(restartApp);
        }}
      />
    </>
  );
}

/**
 * Moldura de navegação do app (expo-router: cada arquivo em src/app é uma tela).
 * Guard de login: com sessão só abre as telas do aluno; sem sessão, só o login.
 */
export default function RootLayout(): ReactElement | null {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const session = useSession();

  useEffect(() => {
    sessionStore
      .hydrate()
      .catch(() => {}) // hydrate já trata falhas como "sem sessão"
      .finally(() => {
        setSessionLoaded(true);
      });
  }, []);

  const ready = (fontsLoaded || fontError !== null) && sessionLoaded;

  useEffect(() => {
    if (ready) {
      hideSplash();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  if (fontError) {
    console.error('[app] Falha ao carregar as fontes do tema.', fontError);
    return (
      <>
        <StatusBar style="light" />
        <ErrorScreen
          title="Não conseguimos abrir o app"
          message="Algo falhou ao carregar a aparência do app. Verifique sua conexão e tente de novo."
          onRetry={restartApp}
        />
      </>
    );
  }

  const signedIn = session !== null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.heading },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: 'HealthFitAI' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: 'Ops!' }} />
      </Stack>
    </>
  );
}

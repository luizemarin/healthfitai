import { useEffect } from 'react';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { fontAssets } from '../theme/fonts';
import { colors, fonts } from '../theme/tokens';

import type { ReactElement } from 'react';

// Mantém a splash até as fontes carregarem (evita piscar com a fonte do sistema).
preventAutoHideAsync().catch(() => {
  // Splash já escondida (ex.: fast refresh): nada a fazer.
});

/**
 * Moldura de navegação do app (expo-router: cada arquivo em src/app é uma tela).
 * Rotas que exigem login serão agrupadas sob um guard (MB-AUT-02).
 */
export default function RootLayout(): ReactElement | null {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

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
        <Stack.Screen name="index" options={{ title: 'HealthFitAI' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Ops!' }} />
      </Stack>
    </>
  );
}

import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { colors } from '../../theme/tokens';
import { useTreinos } from '../../treinos/use-treinos';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Treino } from '../../treinos/treinos-api';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[treinos] Falha ao renderizar a lista de treinos.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir seus treinos"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function ItemTreino({ treino }: { treino: Treino }): ReactElement {
  const total = treino.exercicios.length;

  return (
    <Pressable
      accessibilityHint="Abre o treino para começar"
      accessibilityRole="button"
      className="min-h-12 gap-xs rounded-md border border-border bg-surface p-md active:opacity-70"
      onPress={() => {
        router.push(`/treinos/${treino.id}`);
      }}
    >
      <Text className="font-body-strong text-md text-foreground">{treino.nome}</Text>
      <Text className="font-body text-sm text-foreground-muted">
        {total === 1 ? '1 exercício' : `${String(total)} exercícios`}
      </Text>
    </Pressable>
  );
}

/** Treinos do aluno (/treinos): escolhe qual fazer e abre a execução (MB-TRE-01) ou a evolução (MB-EVO-03). */
export default function TreinosScreen(): ReactElement {
  const { fase, recarregar } = useTreinos();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando seus treinos"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando seus treinos…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar seus treinos"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-sm p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <View className="mb-sm">
        <Button
          label="Evolução do treino"
          variant="secondary"
          onPress={() => {
            router.push('/treinos/evolucao');
          }}
        />
      </View>

      {fase.treinos.length === 0 ? (
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Nenhum treino ainda
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            Os treinos montados pelo seu treinador aparecem aqui.
          </Text>
        </View>
      ) : (
        fase.treinos.map((treino) => <ItemTreino key={treino.id} treino={treino} />)
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

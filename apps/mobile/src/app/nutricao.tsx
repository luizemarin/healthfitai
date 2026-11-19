import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorScreen } from '../components/error-screen';
import { usePlano } from '../nutricao/use-plano';
import { colors } from '../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Refeicao } from '../nutricao/nutricao-api';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[nutricao] Falha ao renderizar o plano nutricional.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir seu plano nutricional"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function CartaoRefeicao({ refeicao }: { refeicao: Refeicao }): ReactElement {
  return (
    <View className="gap-xs rounded-md border border-border bg-surface p-md">
      <View className="flex-row items-baseline justify-between gap-sm">
        <Text
          accessibilityRole="header"
          className="flex-1 font-body-strong text-md text-foreground"
        >
          {refeicao.refeicao}
        </Text>
        {/* Horário vem pronto da API ("07:30"): sem formatar pelo sistema, igual no iOS e no Android. */}
        {refeicao.horario && (
          <Text className="font-numeric text-md text-primary">{refeicao.horario}</Text>
        )}
      </View>
      {/* Texto livre do treinador: as quebras de linha que ele digitou são mantidas. */}
      <Text className="font-body text-md leading-relaxed text-foreground-muted">
        {refeicao.descricao}
      </Text>
    </View>
  );
}

/** Plano nutricional do aluno (/nutricao): o plano em uso, com as refeições na ordem do dia (MB-NUT-01). */
export default function NutricaoScreen(): ReactElement {
  const { fase, recarregar } = usePlano();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando seu plano nutricional"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">
          Carregando seu plano nutricional…
        </Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar seu plano nutricional"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  if (fase.tipo === 'sem-plano') {
    return (
      <View className="flex-1 gap-sm p-lg">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Nenhum plano ainda
        </Text>
        <Text className="font-body text-md text-foreground-muted">
          O plano nutricional montado pelo seu treinador aparece aqui.
        </Text>
      </View>
    );
  }

  const { plano } = fase;

  return (
    <ScrollView
      contentContainerClassName="gap-sm p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
        {plano.nome}
      </Text>

      {plano.observacoes && (
        <View className="mb-sm gap-xs rounded-md border border-border p-md">
          <Text className="font-body-strong text-sm text-foreground">Observações</Text>
          <Text className="font-body text-md leading-relaxed text-foreground-muted">
            {plano.observacoes}
          </Text>
        </View>
      )}

      {plano.refeicoes.map((refeicao) => (
        <CartaoRefeicao key={refeicao.id} refeicao={refeicao} />
      ))}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

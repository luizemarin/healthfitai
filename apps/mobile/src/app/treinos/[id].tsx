import { useEffect } from 'react';

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { colors, spacing } from '../../theme/tokens';
import { CartaoExercicio } from '../../treinos/cartao-exercicio';
import { segundosEntre, useAgora } from '../../treinos/relogio';
import { TimerPill } from '../../treinos/timer-pill';
import { duracao } from '../../treinos/treinos-formato';
import { useExecucao } from '../../treinos/use-execucao';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Descanso } from '../../treinos/use-execucao';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[treinos] Falha ao renderizar a execução do treino.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir o treino"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function voltarAosTreinos(): void {
  // Aberto por link, não há tela anterior: vai para a lista.
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/treinos');
  }
}

/** MB-TRE-01 · Timer em pill no header (headerRight existe igual no iOS e no Android). */
function comTimer(inicio: number, fim: number | null): { headerRight: () => ReactElement } {
  return { headerRight: () => <TimerPill fim={fim} inicio={inicio} /> };
}

/** MB-TRE-02 · Descanso entre as séries: quanto falta do que o treinador pediu. */
function BarraDescanso({
  descanso,
  onEncerrar,
}: {
  descanso: Descanso;
  onEncerrar: () => void;
}): ReactElement {
  const agora = useAgora();
  const passou = segundosEntre(descanso.inicio, agora);
  const falta = descanso.prescritoSegundos - passou;

  return (
    <View className="flex-row items-center gap-md rounded-md border border-border bg-surface p-md">
      <View className="flex-1 gap-xs">
        <Text accessibilityLiveRegion="polite" className="font-body-strong text-md text-foreground">
          {falta > 0 ? 'Descanso' : 'Descanso concluído · próxima série'}
        </Text>
        <Text className="font-numeric text-xl text-primary">
          {duracao(falta > 0 ? falta : passou)}
        </Text>
      </View>
      <Button label="Encerrar" variant="secondary" onPress={onEncerrar} />
    </View>
  );
}

/**
 * MB-TRE-01 / MB-TRE-02 · Execução do treino (/treinos/:id): lista vertical de exercícios, timer
 * em pill no header e botão fixo "Finalizar treino". Em cada série, o aluno anota repetições e
 * carga e marca como feita; o descanso entre as séries é medido.
 */
export default function ExecucaoScreen(): ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    fase,
    inicio,
    fim,
    series,
    erros,
    descanso,
    envio,
    alterar,
    alternar,
    encerrarDescanso,
    finalizar,
    recarregar,
  } = useExecucao(id);
  const alturaHeader = useHeaderHeight();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando o treino"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando o treino…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar o treino"
        // Sem cadastro no aparelho ou link inválido, tentar de novo não muda nada.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const { treino } = fase;
  const timer = inicio === null ? null : <Stack.Screen options={comTimer(inicio, fim)} />;

  if (envio.tipo === 'concluido') {
    return (
      <>
        {timer}
        <View className="flex-1 justify-center gap-sm p-lg">
          <Text accessibilityRole="header" className="font-heading text-xxl text-foreground">
            Treino registrado
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            {inicio !== null && fim !== null
              ? `${treino.nome} · ${duracao(segundosEntre(inicio, fim))}. ${envio.detalhe}`
              : envio.detalhe}
          </Text>
          <View className="mt-xl">
            <Button label="Voltar aos treinos" onPress={voltarAosTreinos} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      {timer}
      <KeyboardAvoidingView
        // Mesmo padrão das outras telas com campos: no iOS a tela sobe com o teclado; no Android o
        // sistema já redimensiona a janela. O offset desconta o header.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={alturaHeader}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-lg p-lg"
          // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
          contentInsetAdjustmentBehavior="never"
          // O teclado numérico do iOS não tem botão de fechar: arrastar a lista fecha (nos dois).
          keyboardDismissMode="on-drag"
          // Tocar no "feita" com o teclado aberto já marca a série (não só fecha o teclado).
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-xs">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {treino.nome}
            </Text>
            <Text className="font-body text-md text-foreground-muted">
              Anote as repetições e a carga de cada série e marque quando terminar.
            </Text>
          </View>

          {treino.exercicios.map((item, indice) => (
            <CartaoExercicio
              key={item.id}
              erros={erros}
              item={item}
              posicao={indice + 1}
              series={series}
              total={treino.exercicios.length}
              onAlterar={alterar}
              onAlternar={alternar}
            />
          ))}
        </ScrollView>

        {/* Rodapé fixo, fora da rolagem. A barra de gestos/navegação vem do inset nos dois. */}
        <View
          className="gap-sm border-t border-border bg-background px-lg pt-md"
          style={{ paddingBottom: bottom + spacing.md }}
        >
          {descanso && <BarraDescanso descanso={descanso} onEncerrar={encerrarDescanso} />}
          {envio.tipo === 'erro' && (
            <Text accessibilityLiveRegion="polite" className="font-body-strong text-md text-danger">
              {envio.mensagem}
            </Text>
          )}
          <Button
            label="Finalizar treino"
            loading={envio.tipo === 'enviando'}
            onPress={finalizar}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

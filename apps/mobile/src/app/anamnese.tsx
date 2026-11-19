import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAnamnese } from '../anamnese/use-anamnese';
import { Button } from '../components/button';
import { ErrorScreen } from '../components/error-screen';
import { Formulario } from '../questionario/formulario';
import { colors } from '../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

/** Volta para o início; se a tela foi aberta direto (sem histórico), abre o início. */
function voltarAoInicio(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui (em vez da genérica
 * do _layout). O que ele já respondeu fica guardado no aparelho e volta ao abrir de novo.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[anamnese] Falha ao renderizar a tela.', error);
  }, [error]);

  return (
    <ErrorScreen
      message="O que você já respondeu ficou guardado. Tente de novo em instantes."
      title="Não conseguimos abrir a anamnese"
      onRetry={() => {
        retry().catch(voltarAoInicio);
      }}
    />
  );
}

/**
 * MB-ANA-01 · Preenchimento da anamnese · MB-ANA-02 · Autosave de rascunho (/anamnese).
 * A regra (abrir, autosave, enviar) fica em questionario/use-questionario.ts; aqui só a tela.
 */
export default function AnamneseScreen(): ReactElement {
  const anamnese = useAnamnese();
  const { fase } = anamnese;

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando sua anamnese"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando sua anamnese…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos abrir a anamnese"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: anamnese.recarregar })}
      />
    );
  }

  if (fase.tipo === 'enviada') {
    return (
      <View className="flex-1 justify-center gap-md p-lg">
        <Text accessibilityRole="header" className="font-heading text-xxl text-foreground">
          Anamnese enviada
        </Text>
        <Text className="font-body text-md text-foreground-muted">
          Obrigado! Suas respostas foram enviadas ao seu treinador.
        </Text>
        <View className="mt-md">
          <Button label="Voltar ao início" onPress={voltarAoInicio} />
        </View>
      </View>
    );
  }

  return (
    <Formulario
      labelEnviar="Enviar anamnese"
      questionario={anamnese}
      submissao={fase.submissao}
      onSair={voltarAoInicio}
    />
  );
}

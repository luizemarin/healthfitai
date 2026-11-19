import { useEffect } from 'react';

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { Comentarios } from '../../feedbacks/comentarios';
import { PARA_O_ALUNO } from '../../feedbacks/feedback-formato';
import { StatusFeedbackBadge } from '../../feedbacks/status-feedback';
import { useFeedback } from '../../feedbacks/use-feedback';
import { Formulario } from '../../questionario/formulario';
import { submissoesApi } from '../../questionario/submissoes-api';
import { useQuestionario } from '../../questionario/use-questionario';
import { colors } from '../../theme/tokens';
import { dataCurta } from '../../utils/datas';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Feedback } from '../../feedbacks/feedbacks-api';

/** Volta para a lista; se a tela foi aberta pelo link do e-mail (sem histórico), abre a lista. */
function voltarAosFeedbacks(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/feedbacks');
  }
}

/**
 * Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. O que ele já
 * respondeu fica guardado no aparelho e volta ao abrir de novo.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[feedback] Falha ao renderizar a tela.', error);
  }, [error]);

  return (
    <ErrorScreen
      message="O que você já respondeu ficou guardado. Tente de novo em instantes."
      title="Não conseguimos abrir o feedback"
      onRetry={() => {
        retry().catch(voltarAosFeedbacks);
      }}
    />
  );
}

function Carregando({ texto }: { texto: string }): ReactElement {
  return (
    <View accessibilityLabel={texto} className="flex-1 items-center justify-center gap-md p-lg">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text className="font-body text-md text-foreground-muted">{texto}</Text>
    </View>
  );
}

/**
 * MB-FBK-02 · Responder feedback. Mesmo formulário e autosave da anamnese, com o modelo do
 * feedback: a API abre o rascunho ou retoma o que já estava aberto.
 */
function ResponderFeedback({ feedback }: { feedback: Feedback }): ReactElement {
  const questionario = useQuestionario({
    abrir: async (quem) => submissoesApi.abrir(quem, feedback.modelo.id),
    chaveRascunho: () => `feedback-rascunho-${feedback.id}`,
    nome: 'o feedback',
    paraOAluno: PARA_O_ALUNO,
    // Ao enviar, o back marca este feedback como respondido (BE-FBK-04).
    feedbackId: feedback.id,
  });
  const { fase } = questionario;

  if (fase.tipo === 'carregando') {
    return <Carregando texto="Abrindo o feedback…" />;
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos abrir o feedback"
        {...(fase.podeTentarDeNovo && { onRetry: questionario.recarregar })}
      />
    );
  }

  if (fase.tipo === 'enviada') {
    return (
      <View className="flex-1 justify-center gap-md p-lg">
        <Text accessibilityRole="header" className="font-heading text-xxl text-foreground">
          Feedback enviado
        </Text>
        <Text className="font-body text-md text-foreground-muted">
          Obrigado! Suas respostas foram enviadas ao seu treinador.
        </Text>
        <View className="mt-md">
          <Button label="Voltar aos feedbacks" onPress={voltarAosFeedbacks} />
        </View>
      </View>
    );
  }

  return (
    <Formulario
      labelEnviar="Enviar feedback"
      questionario={questionario}
      submissao={fase.submissao}
      onSair={voltarAosFeedbacks}
    />
  );
}

/** MB-FBK-03 · Feedback respondido: quando foi respondido e os comentários do treinador. */
function FeedbackRespondido({ feedback }: { feedback: Feedback }): ReactElement {
  const { bottom } = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerClassName="gap-xl p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <View className="gap-sm">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          {feedback.modelo.nome}
        </Text>
        <StatusFeedbackBadge status={feedback.status} />
        {feedback.respondidoEm && (
          <Text className="font-body text-sm text-foreground-muted">
            Respondido em {dataCurta(feedback.respondidoEm)}
          </Text>
        )}
      </View>

      <Comentarios comentarios={feedback.comentarios} />

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

/**
 * Feedback do aluno (/feedbacks/:id), aberto pela lista ou pelo link do e-mail
 * (healthfitai://feedbacks/<id>, MB-FBK-02).
 *   pendente ou atrasado → formulário para responder
 *   respondido           → comentários do treinador (MB-FBK-03)
 *   agendado             → ainda não liberado
 */
export default function FeedbackScreen(): ReactElement {
  const { id } = useLocalSearchParams();
  const { fase, recarregar } = useFeedback(id);

  if (fase.tipo === 'carregando') {
    return <Carregando texto="Carregando o feedback…" />;
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos abrir o feedback"
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const { feedback } = fase;
  switch (feedback.status) {
    case 'enviado':
    case 'atrasado':
      return <ResponderFeedback feedback={feedback} />;

    case 'respondido':
      return <FeedbackRespondido feedback={feedback} />;

    default:
      return (
        <ErrorScreen
          message="Este feedback ainda não foi liberado para resposta."
          title="Feedback ainda não disponível"
        />
      );
  }
}

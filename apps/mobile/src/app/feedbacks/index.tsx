import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { SECOES, textoComentarios } from '../../feedbacks/feedback-formato';
import { useFeedbacks } from '../../feedbacks/use-feedbacks';
import { colors } from '../../theme/tokens';
import { dataCurta } from '../../utils/datas';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { FeedbackResumo } from '../../feedbacks/feedbacks-api';
import type { Secao } from '../../feedbacks/use-feedbacks';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[feedbacks] Falha ao renderizar a lista.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir seus feedbacks"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

/** Data que importa para o aluno: quando respondeu, ou quando o feedback chegou. */
function dataDoItem({ status, enviadoEm, respondidoEm }: FeedbackResumo): string | null {
  if (status === 'respondido' && respondidoEm) {
    return `Respondido em ${dataCurta(respondidoEm)}`;
  }
  return enviadoEm ? `Recebido em ${dataCurta(enviadoEm)}` : null;
}

function ItemFeedback({ feedback }: { feedback: FeedbackResumo }): ReactElement {
  const data = dataDoItem(feedback);

  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-12 gap-xs rounded-md border border-border bg-surface p-md active:opacity-70"
      onPress={() => {
        router.push(`/feedbacks/${feedback.id}`);
      }}
    >
      <Text className="font-body-strong text-md text-foreground">{feedback.modelo.nome}</Text>
      {data && <Text className="font-body text-sm text-foreground-muted">{data}</Text>}
      {feedback.totalComentarios > 0 && (
        <Text className="font-body text-sm text-foreground">
          {textoComentarios(feedback.totalComentarios)}
        </Text>
      )}
    </Pressable>
  );
}

function SecaoFeedbacks({
  secao,
  onVerMais,
}: {
  secao: Secao;
  onVerMais: () => void;
}): ReactElement {
  const { titulo, vazio } = SECOES.find(({ status }) => status === secao.status) ?? {
    titulo: '',
    vazio: '',
  };

  return (
    <View className="gap-sm">
      <Text
        accessibilityRole="header"
        className={`font-heading text-lg ${secao.status === 'atrasado' && secao.total > 0 ? 'text-danger' : 'text-foreground'}`}
      >
        {titulo} <Text className="font-numeric">({secao.total})</Text>
      </Text>

      {secao.itens.length === 0 && (
        <Text className="font-body text-md text-foreground-muted">{vazio}</Text>
      )}
      {secao.itens.map((feedback) => (
        <ItemFeedback key={feedback.id} feedback={feedback} />
      ))}

      {secao.erroMais && (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
          {secao.erroMais}
        </Text>
      )}
      {secao.temMais && (
        <Button
          label="Ver mais"
          loading={secao.carregandoMais}
          variant="secondary"
          onPress={onVerMais}
        />
      )}
    </View>
  );
}

/**
 * MB-FBK-01 · Lista de feedbacks e status (/feedbacks): pendentes, atrasados e respondidos.
 * Tocar num feedback abre o formulário (pendente/atrasado) ou os comentários (respondido).
 */
export default function FeedbacksScreen(): ReactElement {
  const { fase, carregarMais, recarregar } = useFeedbacks();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando seus feedbacks"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando seus feedbacks…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar seus feedbacks"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const nenhum = fase.secoes.every((secao) => secao.total === 0);

  return (
    <ScrollView
      contentContainerClassName="gap-xl p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      {nenhum ? (
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Nenhum feedback por enquanto
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            Quando seu treinador liberar um feedback, ele aparece aqui.
          </Text>
        </View>
      ) : (
        fase.secoes.map((secao) => (
          <SecaoFeedbacks
            key={secao.status}
            secao={secao}
            onVerMais={() => {
              carregarMais(secao.status);
            }}
          />
        ))
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

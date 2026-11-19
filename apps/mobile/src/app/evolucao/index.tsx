import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { GraficoLinha } from '../../evolucao/grafico-linha';
import { useEvolucao } from '../../evolucao/use-evolucao';
import { colors } from '../../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[evolucao] Falha ao renderizar os gráficos de evolução.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir sua evolução"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function irParaRegistro(): void {
  router.push('/evolucao/registrar');
}

function Secao({ titulo, children }: { titulo: string; children: ReactElement[] }): ReactElement {
  return (
    <View className="gap-md">
      <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
        {titulo}
      </Text>
      {children}
    </View>
  );
}

/**
 * MB-EVO-02 · Gráficos de evolução (/evolucao): peso, cada medida e cada pergunta marcada pelo
 * treinador para aparecer no gráfico, desde o primeiro registro.
 */
export default function EvolucaoScreen(): ReactElement {
  const { fase, recarregar } = useEvolucao();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando sua evolução"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando sua evolução…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar sua evolução"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const { peso, medidas, perguntas } = fase.evolucao;
  const vazia = peso.pontos.length === 0 && medidas.length === 0 && perguntas.length === 0;

  return (
    <ScrollView
      contentContainerClassName="gap-xl p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <Button label="Registrar peso e medidas" onPress={irParaRegistro} />

      {vazia ? (
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Nenhum registro ainda
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            Seu peso, suas medidas e as respostas acompanhadas pelo seu treinador aparecem aqui em
            gráficos.
          </Text>
        </View>
      ) : (
        <>
          <GraficoLinha pontos={peso.pontos} titulo="Peso" unidade={peso.unidade} />

          {medidas.length > 0 && (
            <Secao titulo="Medidas">
              {medidas.map((serie) => (
                <GraficoLinha
                  key={serie.tipo.id}
                  pontos={serie.pontos}
                  titulo={serie.tipo.nome}
                  unidade={serie.tipo.unidade}
                />
              ))}
            </Secao>
          )}

          {perguntas.length > 0 && (
            <Secao titulo="Questionários">
              {perguntas.map((serie) => (
                <GraficoLinha
                  key={serie.perguntaId}
                  max={serie.max}
                  min={serie.min}
                  pontos={serie.pontos}
                  subtitulo={serie.modelo.nome}
                  titulo={serie.enunciado}
                  unidade={serie.unidade}
                />
              ))}
            </Secao>
          )}
        </>
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

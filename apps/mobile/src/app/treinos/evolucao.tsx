import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorScreen } from '../../components/error-screen';
import { GraficoLinha } from '../../evolucao/grafico-linha';
import { colors } from '../../theme/tokens';
import { FrequenciaSemanal } from '../../treinos/frequencia-semanal';
import { useEvolucaoTreino } from '../../treinos/use-evolucao-treino';
import { dataDoDia } from '../../utils/datas';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { ProgressaoCarga } from '../../treinos/treinos-api';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[evolucao-treino] Falha ao renderizar a evolução do treino.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir a evolução do treino"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/treinos');
        });
      }}
    />
  );
}

/** Uma linha por exercício: a maior carga de cada dia treinado (reusa o gráfico do MB-EVO-02). */
function CargaDoExercicio({ progressao }: { progressao: ProgressaoCarga }): ReactElement {
  const { exercicio, pontos } = progressao;

  return (
    <GraficoLinha
      pontos={pontos.map(({ data, cargaMaximaKg }) => ({ data, valor: cargaMaximaKg }))}
      titulo={exercicio.nome}
      unidade="kg"
      {...(exercicio.grupoMuscular !== '' && { subtitulo: exercicio.grupoMuscular })}
    />
  );
}

/**
 * MB-EVO-03 · Evolução do treino (/treinos/evolucao): barras de frequência semanal e progressão de
 * carga por exercício, no período padrão da API (últimos 30 dias).
 */
export default function EvolucaoTreinoScreen(): ReactElement {
  const { fase, recarregar } = useEvolucaoTreino();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando a evolução do treino"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">
          Carregando a evolução do treino…
        </Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar a evolução do treino"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const { periodo, frequencia, progressaoCarga } = fase.evolucao;

  return (
    <ScrollView
      contentContainerClassName="gap-xl p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <Text className="font-body text-sm text-foreground-muted">
        {`Últimos ${String(periodo.dias)} dias (${dataDoDia(periodo.de)} a ${dataDoDia(periodo.ate)})`}
      </Text>

      {frequencia.treinos === 0 ? (
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Nenhum treino finalizado
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            Quando você finalizar seus treinos, aqui aparecem quantos fez por semana e como a carga
            de cada exercício evolui.
          </Text>
        </View>
      ) : (
        <>
          <FrequenciaSemanal
            mediaSemanal={frequencia.mediaSemanal}
            semanas={frequencia.semanas}
            totalTreinos={frequencia.treinos}
          />

          <View className="gap-md">
            <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
              Progressão de carga
            </Text>
            {progressaoCarga.length === 0 ? (
              <Text className="font-body text-md text-foreground-muted">
                Nenhuma carga registrada nos treinos deste período.
              </Text>
            ) : (
              progressaoCarga.map((progressao) => (
                <CargaDoExercicio key={progressao.exercicio.id} progressao={progressao} />
              ))
            )}
          </View>
        </>
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

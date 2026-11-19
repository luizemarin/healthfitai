import { Text, View } from 'react-native';

import { treinos } from './treinos-formato';
import { numeroBr } from '../questionario/valores';
import { dataDoDia } from '../utils/datas';

import type { ReactElement } from 'react';

import type { Semana } from './treinos-api';

/** Altura máxima da barra (a semana com mais treinos). */
const ALTURA = 120;

/** "AAAA-MM-DD" → "DD/MM" (o ano fica no texto do período, acima). */
const diaEMes = (aaaaMmDd: string): string => dataDoDia(aaaaMmDd).slice(0, 5);

interface FrequenciaSemanalProps {
  /** Todas as semanas do período, inclusive as sem treino (como a API devolve). */
  semanas: Semana[];
  mediaSemanal: number;
  totalTreinos: number;
}

/**
 * MB-EVO-03 · Barras de frequência semanal: treinos finalizados em cada semana (segunda a domingo).
 *
 * Barras feitas com <View> (sem SVG nem lib de gráfico): mesmo desenho no iOS e no Android, e os
 * números usam as fontes do tema. A API manda até ~6 semanas (últimos 30 dias), cabe na largura.
 */
export function FrequenciaSemanal({
  semanas,
  mediaSemanal,
  totalTreinos,
}: FrequenciaSemanalProps): ReactElement {
  const maior = Math.max(1, ...semanas.map((semana) => semana.treinos));
  const resumo = semanas
    .map(
      ({ inicio, fim, treinos: feitos }) =>
        `de ${diaEMes(inicio)} a ${diaEMes(fim)}, ${treinos(feitos)}`,
    )
    .join('; ');

  return (
    <View className="gap-sm rounded-md border border-border bg-surface p-md">
      <Text accessibilityRole="header" className="font-heading text-md text-foreground">
        Frequência semanal
      </Text>

      <Text className="font-body text-sm text-foreground-muted">
        <Text className="font-numeric text-xl text-foreground">{numeroBr(mediaSemanal)}</Text>
        {`  por semana · ${treinos(totalTreinos)} no período`}
      </Text>

      {/* Um só elemento para o leitor de tela (VoiceOver e TalkBack): o resumo das semanas. */}
      <View accessible accessibilityLabel={`Frequência semanal: ${resumo}.`} className="gap-xs">
        <View className="flex-row items-end border-b border-border" style={{ height: ALTURA + 20 }}>
          {semanas.map((semana) => (
            <View key={semana.inicio} className="flex-1 items-center justify-end gap-xs">
              <Text className="font-numeric text-xs text-foreground">{semana.treinos}</Text>
              <View
                className="rounded-sm bg-primary"
                style={{ height: (semana.treinos / maior) * ALTURA, width: '60%' }}
              />
            </View>
          ))}
        </View>

        <View className="flex-row">
          {semanas.map((semana) => (
            <Text
              key={semana.inicio}
              className="flex-1 text-center font-numeric text-xs text-foreground-muted"
            >
              {diaEMes(semana.inicio)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

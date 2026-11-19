import { useState } from 'react';

import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { comUnidade } from './evolucao-formato';
import { numeroBr } from '../questionario/valores';
import { colors } from '../theme/tokens';
import { dataDoDia } from '../utils/datas';

import type { ReactElement } from 'react';

import type { Ponto } from './evolucao-api';

/** Altura da área do gráfico. A largura é a do cartão (medida na tela, igual nos dois sistemas). */
const ALTURA = 160;
const RAIO = 4;
/** Folga nas bordas para o ponto não ser cortado. */
const FOLGA = RAIO + 2;
const MS_POR_DIA = 86_400_000;

interface GraficoLinhaProps {
  titulo: string;
  /** Linha abaixo do título (ex.: o questionário de onde vem a pergunta). */
  subtitulo?: string;
  unidade: string | null;
  /** Em ordem de data, um por dia (como a API devolve). */
  pontos: Ponto[];
  /** Eixo Y fixo, quando a série tem limites (ex.: escala de 0 a 10). */
  min?: number | null;
  max?: number | null;
}

/** "AAAA-MM-DD" → dia corrido. Em UTC de propósito: o fuso do aparelho não mexe na distância. */
function diaCorrido(aaaaMmDd: string): number {
  const [ano = 0, mes = 1, dia = 1] = aaaaMmDd.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia) / MS_POR_DIA;
}

/** Limites do eixo Y: os da série, se houver, sem cortar nenhum valor; nunca uma faixa zero. */
function eixoY(valores: number[], min?: number | null, max?: number | null): [number, number] {
  let baixo = Math.min(...valores, min ?? Number.POSITIVE_INFINITY);
  let alto = Math.max(...valores, max ?? Number.NEGATIVE_INFINITY);
  if (baixo === alto) {
    baixo -= 1;
    alto += 1;
  }
  return [baixo, alto];
}

const rotulo = (valor: number): string => numeroBr(Number(valor.toFixed(2)));

/**
 * MB-EVO-02 · Gráfico de linha de uma série (peso, uma medida ou uma pergunta flagada).
 *
 * Desenhado com react-native-svg (mesmo desenho no iOS e no Android). Textos (valores e datas)
 * ficam em <Text> do React Native, fora do SVG, para usar as fontes do tema nos dois sistemas.
 * O eixo X respeita a distância entre as datas (registros espaçados ficam espaçados).
 */
export function GraficoLinha({
  titulo,
  subtitulo,
  unidade,
  pontos,
  min,
  max,
}: GraficoLinhaProps): ReactElement {
  const [largura, setLargura] = useState(0);
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];

  return (
    <View className="gap-sm rounded-md border border-border bg-surface p-md">
      <View className="gap-xs">
        <Text accessibilityRole="header" className="font-heading text-md text-foreground">
          {titulo}
        </Text>
        {subtitulo && <Text className="font-body text-xs text-foreground-muted">{subtitulo}</Text>}
      </View>

      {!primeiro || !ultimo ? (
        <Text className="font-body text-sm text-foreground-muted">Nenhum registro ainda.</Text>
      ) : (
        <>
          <Text className="font-body text-sm text-foreground-muted">
            <Text className="font-numeric text-xl text-foreground">
              {comUnidade(ultimo.valor, unidade)}
            </Text>
            {`  em ${dataDoDia(ultimo.data)}`}
          </Text>

          <Desenho
            altura={ALTURA}
            largura={largura}
            max={max}
            min={min}
            pontos={pontos}
            resumo={`${titulo}: ${String(pontos.length)} registro(s), de ${comUnidade(primeiro.valor, unidade)} em ${dataDoDia(primeiro.data)} a ${comUnidade(ultimo.valor, unidade)} em ${dataDoDia(ultimo.data)}.`}
            onLargura={setLargura}
          />
        </>
      )}
    </View>
  );
}

function Desenho({
  pontos,
  largura,
  altura,
  min,
  max,
  resumo,
  onLargura,
}: {
  pontos: Ponto[];
  largura: number;
  altura: number;
  min: number | null | undefined;
  max: number | null | undefined;
  resumo: string;
  onLargura: (largura: number) => void;
}): ReactElement {
  const [baixo, alto] = eixoY(
    pontos.map((ponto) => ponto.valor),
    min,
    max,
  );
  const dias = pontos.map((ponto) => diaCorrido(ponto.data));
  const diaInicial = dias[0] ?? 0;
  const periodo = (dias[dias.length - 1] ?? 0) - diaInicial;

  const x = (dia: number): number =>
    periodo === 0 ? largura / 2 : FOLGA + ((dia - diaInicial) / periodo) * (largura - 2 * FOLGA);
  const y = (valor: number): number =>
    FOLGA + ((alto - valor) / (alto - baixo)) * (altura - 2 * FOLGA);

  const coordenadas = pontos.map((ponto, indice) => ({
    data: ponto.data,
    cx: x(dias[indice] ?? diaInicial),
    cy: y(ponto.valor),
  }));

  return (
    // Um só elemento para o leitor de tela (VoiceOver e TalkBack): o resumo da série.
    <View accessible accessibilityLabel={resumo} className="flex-row gap-sm">
      <View className="justify-between" style={{ height: altura }}>
        <Text className="font-numeric text-xs text-foreground-muted">{rotulo(alto)}</Text>
        <Text className="font-numeric text-xs text-foreground-muted">{rotulo(baixo)}</Text>
      </View>

      <View className="flex-1 gap-xs">
        <View
          style={{ height: altura }}
          onLayout={(event) => {
            onLargura(event.nativeEvent.layout.width);
          }}
        >
          {/* Só desenha depois de saber a largura (evita um primeiro quadro torto). */}
          {largura > 0 && (
            <Svg height={altura} width={largura}>
              <Line
                stroke={colors.border}
                strokeWidth={1}
                x1={0}
                x2={largura}
                y1={FOLGA}
                y2={FOLGA}
              />
              <Line
                stroke={colors.border}
                strokeWidth={1}
                x1={0}
                x2={largura}
                y1={altura - FOLGA}
                y2={altura - FOLGA}
              />
              {coordenadas.length > 1 && (
                <Polyline
                  fill="none"
                  points={coordenadas.map(({ cx, cy }) => `${String(cx)},${String(cy)}`).join(' ')}
                  stroke={colors.primary}
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              )}
              {coordenadas.map(({ data, cx, cy }) => (
                <Circle
                  key={data}
                  cx={cx}
                  cy={cy}
                  fill={colors.primary}
                  r={RAIO}
                  stroke={colors.surface}
                  strokeWidth={1}
                />
              ))}
            </Svg>
          )}
        </View>

        <View className="flex-row justify-between">
          <Text className="font-numeric text-xs text-foreground-muted">
            {dataDoDia(pontos[0]?.data ?? '')}
          </Text>
          {pontos.length > 1 && (
            <Text className="font-numeric text-xs text-foreground-muted">
              {dataDoDia(pontos[pontos.length - 1]?.data ?? '')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

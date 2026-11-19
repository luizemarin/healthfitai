import { useState } from 'react';

import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { FotoImagem } from './foto-imagem';
import { useComparacao } from './use-galeria';
import { Button } from '../components/button';
import { colors } from '../theme/tokens';
import { dataDoDia } from '../utils/datas';

import type { ReactElement } from 'react';

import type { Comparacao, Foto } from './fotos-api';

/** Linha de datas para escolher (botões, não o seletor nativo, que muda entre iOS e Android). */
function EscolhaDeData({
  titulo,
  datas,
  selecionada,
  onEscolher,
}: {
  titulo: string;
  datas: string[];
  selecionada: string;
  onEscolher: (data: string) => void;
}): ReactElement {
  return (
    <View className="gap-xs">
      <Text className="font-body-strong text-sm text-foreground">{titulo}</Text>
      <ScrollView
        horizontal
        // Sem o "pulo" do iOS nem o brilho do Android no fim da linha: igual nos dois.
        bounces={false}
        contentContainerClassName="gap-sm"
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
      >
        {datas.map((data) => {
          const marcada = data === selecionada;
          return (
            <Pressable
              key={data}
              accessibilityLabel={`${titulo}: ${dataDoDia(data)}`}
              accessibilityRole="button"
              accessibilityState={{ selected: marcada }}
              className={`min-h-12 justify-center rounded-pill border px-md active:opacity-70 ${marcada ? 'border-foreground bg-border' : 'border-border'}`}
              onPress={() => {
                onEscolher(data);
              }}
            >
              <Text className="font-numeric text-sm text-foreground">{dataDoDia(data)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Lado({
  rotulo,
  data,
  foto,
  nomePose,
  onRecarregar,
}: {
  rotulo: string;
  data: string;
  foto: Foto | null;
  nomePose: string;
  onRecarregar: () => void;
}): ReactElement {
  return (
    <View className="flex-1 gap-xs">
      <Text className="font-body text-xs text-foreground-muted">
        {rotulo} · <Text className="font-numeric">{dataDoDia(data)}</Text>
      </Text>
      {foto ? (
        <FotoImagem
          descricao={`${nomePose}, ${rotulo.toLowerCase()}, ${dataDoDia(data)}`}
          uri={foto.url}
          onRecarregar={onRecarregar}
        />
      ) : (
        <View
          className="w-full items-center justify-center rounded-sm border border-border bg-background p-sm"
          style={{ aspectRatio: 3 / 4 }}
        >
          <Text className="text-center font-body text-xs text-foreground-muted">
            Sem foto desta pose nesta data.
          </Text>
        </View>
      )}
    </View>
  );
}

function Resultado({
  comparacao,
  onRecarregar,
}: {
  comparacao: Comparacao;
  onRecarregar: () => void;
}): ReactElement {
  if (comparacao.poses.length === 0) {
    return (
      <Text className="font-body text-md text-foreground-muted">
        Nada para comparar. Escolha outras datas.
      </Text>
    );
  }

  return (
    <View className="gap-lg">
      {comparacao.poses.map(({ pose, antes, depois }) => (
        <View key={pose.id} className="gap-sm">
          <Text className="font-heading text-md text-foreground">{pose.nome}</Text>
          <View className="flex-row gap-sm">
            <Lado
              data={comparacao.antes}
              foto={antes}
              nomePose={pose.nome}
              rotulo="Antes"
              onRecarregar={onRecarregar}
            />
            <Lado
              data={comparacao.depois}
              foto={depois}
              nomePose={pose.nome}
              rotulo="Depois"
              onRecarregar={onRecarregar}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * MB-FOT-02 · Antes/depois: escolhe duas datas e vê, pose a pose, as fotos lado a lado.
 * `datas` vem da galeria, da mais recente para a mais antiga (precisa ter pelo menos 2).
 * Começa comparando a data mais antiga com a mais recente (como no painel web).
 */
export function Comparador({ datas }: { datas: string[] }): ReactElement {
  const maisRecente = datas[0] ?? '';
  const [antes, setAntes] = useState(datas[datas.length - 1] ?? '');
  const [depois, setDepois] = useState(maisRecente);
  const { fase, recarregar } = useComparacao(antes, depois);

  /** "Depois" precisa ser posterior a "antes" (regra do back); se não for, vira a mais recente. */
  const trocarAntes = (data: string): void => {
    setAntes(data);
    if (depois <= data) {
      setDepois(maisRecente);
    }
  };

  return (
    <View className="gap-md rounded-md border border-border bg-surface p-md">
      <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
        Antes e depois
      </Text>

      {/* A mais recente fica de fora em "Antes": não haveria "depois" para ela. */}
      <EscolhaDeData
        datas={datas.slice(1)}
        selecionada={antes}
        titulo="Antes"
        onEscolher={trocarAntes}
      />
      <EscolhaDeData
        datas={datas.filter((data) => data > antes)}
        selecionada={depois}
        titulo="Depois"
        onEscolher={setDepois}
      />

      {fase.tipo === 'carregando' && (
        <View accessibilityLabel="Carregando a comparação" className="items-center p-lg">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {fase.tipo === 'erro' && (
        <View className="gap-sm">
          <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
            {fase.mensagem}
          </Text>
          <Button label="Tentar novamente" variant="secondary" onPress={recarregar} />
        </View>
      )}
      {fase.tipo === 'pronta' && (
        <Resultado comparacao={fase.comparacao} onRecarregar={recarregar} />
      )}
    </View>
  );
}

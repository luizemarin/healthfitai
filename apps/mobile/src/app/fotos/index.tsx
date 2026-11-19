import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { Comparador } from '../../fotos/comparador';
import { FotoImagem } from '../../fotos/foto-imagem';
import { useGaleria } from '../../fotos/use-galeria';
import { colors } from '../../theme/tokens';
import { dataDoDia } from '../../utils/datas';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { FotosDoDia } from '../../fotos/fotos-api';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[fotos] Falha ao renderizar a galeria.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir suas fotos"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function irParaEnvio(): void {
  router.push('/fotos/enviar');
}

function Dia({ dia, onRecarregar }: { dia: FotosDoDia; onRecarregar: () => void }): ReactElement {
  const data = dataDoDia(dia.dataRegistro);

  return (
    <View className="gap-sm rounded-md border border-border bg-surface p-md">
      <Text accessibilityRole="header" className="font-numeric text-md text-foreground">
        {data}
      </Text>
      <View className="flex-row flex-wrap gap-sm">
        {dia.fotos.map((foto) => (
          // 3 por linha (31% + espaços), em qualquer largura de tela.
          <View key={foto.id} className="gap-xs" style={{ width: '31%' }}>
            <FotoImagem
              descricao={`${foto.pose.nome}, ${data}`}
              uri={foto.miniaturaUrl ?? foto.url}
              onRecarregar={onRecarregar}
            />
            <Text className="font-body text-xs text-foreground-muted" numberOfLines={1}>
              {foto.pose.nome}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * MB-FOT-02 · Galeria e comparador do aluno (/fotos): antes/depois entre duas datas e as fotos
 * agrupadas por data e pose (mais recentes primeiro).
 */
export default function FotosScreen(): ReactElement {
  const { fase, carregarMais, recarregar } = useGaleria();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando suas fotos"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando suas fotos…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar suas fotos"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  const datas = fase.dias.map((dia) => dia.dataRegistro);

  return (
    <ScrollView
      contentContainerClassName="gap-xl p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <Button label="Enviar fotos" onPress={irParaEnvio} />

      {fase.dias.length === 0 ? (
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Nenhuma foto ainda
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            As fotos que você enviar aparecem aqui, agrupadas por data e pose.
          </Text>
        </View>
      ) : (
        <>
          {datas.length >= 2 ? (
            // key: ao recarregar com datas novas, o comparador recomeça com elas.
            <Comparador key={datas.join()} datas={datas} />
          ) : (
            <Text className="rounded-md border border-border bg-surface p-md font-body text-md text-foreground-muted">
              Quando houver fotos em duas datas diferentes, o antes e depois aparece aqui.
            </Text>
          )}

          <View className="gap-md">
            <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
              Fotos por data
            </Text>
            {fase.dias.map((dia) => (
              <Dia key={dia.dataRegistro} dia={dia} onRecarregar={recarregar} />
            ))}

            {fase.erroMais && (
              <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
                {fase.erroMais}
              </Text>
            )}
            {fase.temMais && (
              <Button
                label="Ver mais"
                loading={fase.carregandoMais}
                variant="secondary"
                onPress={carregarMais}
              />
            )}
          </View>
        </>
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

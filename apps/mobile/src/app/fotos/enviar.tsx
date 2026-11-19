import { useEffect } from 'react';

import { router } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { FotoImagem } from '../../fotos/foto-imagem';
import { posicaoDaPose } from '../../fotos/fotos-formato';
import { useEnvioFotos } from '../../fotos/use-envio-fotos';
import { colors } from '../../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Pose } from '../../fotos/fotos-api';
import type { AvisoPermissao, EstadoPose } from '../../fotos/use-envio-fotos';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[fotos] Falha ao renderizar o envio de fotos.', error);
  }, [error]);

  return (
    <ErrorScreen
      message="As fotos que já foram enviadas estão guardadas. Tente de novo em instantes."
      title="Não conseguimos abrir o envio de fotos"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

function abrirAjustes(): void {
  // Abre os ajustes do app no iOS e no Android (mesma chamada nos dois).
  Linking.openSettings().catch((error: unknown) => {
    console.warn('[fotos] Não foi possível abrir os ajustes do aparelho.', error);
  });
}

function Aviso({ aviso }: { aviso: AvisoPermissao }): ReactElement {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="gap-sm rounded-md border border-danger bg-surface p-md"
    >
      <Text className="font-body-strong text-md text-foreground">Sem acesso à câmera</Text>
      <Text className="font-body text-sm text-foreground-muted">
        {aviso.abrirAjustes
          ? 'Para tirar a foto, libere o acesso à câmera nos ajustes do aparelho. Você também pode escolher uma foto da galeria.'
          : 'Para tirar a foto, permita o acesso à câmera quando o aparelho perguntar. Você também pode escolher uma foto da galeria.'}
      </Text>
      {aviso.abrirAjustes && (
        <Button label="Abrir ajustes" variant="secondary" onPress={abrirAjustes} />
      )}
    </View>
  );
}

function Status({
  estado,
  nomePose,
}: {
  estado: EstadoPose;
  nomePose: string;
}): ReactElement | null {
  switch (estado.tipo) {
    case 'preparando':
    case 'enviando': {
      const texto = estado.tipo === 'preparando' ? 'Preparando a foto…' : 'Enviando a foto…';
      return (
        <View accessibilityLabel={texto} className="flex-row items-center gap-sm">
          <ActivityIndicator color={colors.primary} />
          <Text className="font-body text-sm text-foreground-muted">{texto}</Text>
        </View>
      );
    }
    case 'enviada':
      return (
        <View className="flex-row items-center gap-md">
          <View style={{ width: '30%' }}>
            <FotoImagem
              descricao={`Foto enviada: ${nomePose}`}
              uri={estado.foto.miniaturaUrl ?? estado.foto.url}
            />
          </View>
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 font-body text-sm text-foreground"
          >
            Foto enviada. Se quiser, envie outra: a mais recente do dia é a que vale no antes e
            depois.
          </Text>
        </View>
      );
    case 'erro':
      return (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
          {estado.mensagem}
        </Text>
      );
    default:
      return null;
  }
}

function CartaoPose({
  pose,
  indice,
  total,
  estado,
  onTirar,
  onEscolher,
  onTentarDeNovo,
}: {
  pose: Pose;
  indice: number;
  total: number;
  estado: EstadoPose;
  onTirar: () => void;
  onEscolher: () => void;
  onTentarDeNovo: () => void;
}): ReactElement {
  const ocupada = estado.tipo === 'preparando' || estado.tipo === 'enviando';

  return (
    <View className="gap-md rounded-md border border-border bg-surface p-md">
      {/* Guia da pose: qual é e em que ordem o treinador pede. */}
      <View className="gap-xs">
        <Text className="font-body text-sm text-foreground-muted">
          {posicaoDaPose(indice, total)}
        </Text>
        <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
          {pose.nome}
        </Text>
      </View>

      <Status estado={estado} nomePose={pose.nome} />

      {!ocupada && (
        <View className="gap-sm">
          {estado.tipo === 'erro' && estado.arquivo && (
            <Button label="Tentar de novo" onPress={onTentarDeNovo} />
          )}
          <Button
            label="Tirar foto"
            variant={estado.tipo === 'erro' && estado.arquivo ? 'secondary' : 'primary'}
            onPress={onTirar}
          />
          <Button label="Escolher da galeria" variant="secondary" onPress={onEscolher} />
        </View>
      )}
    </View>
  );
}

/**
 * MB-FOT-01 · Envio de fotos por pose (/fotos/enviar): para cada pose pedida pelo treinador,
 * na ordem dele, tira a foto ou escolhe da galeria. A foto sobe na hora, com retentativa.
 */
export default function EnviarFotosScreen(): ReactElement {
  const { fase, estados, aviso, tirar, escolher, tentarDeNovo, recarregar } = useEnvioFotos();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando as poses"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando as poses…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos carregar as poses"
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-lg p-lg"
      // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
      contentInsetAdjustmentBehavior="never"
    >
      <View className="gap-sm">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Fotos de hoje
        </Text>
        <Text className="font-body text-md text-foreground-muted">
          Envie uma foto para cada pose pedida pelo seu treinador, na ordem abaixo.
        </Text>
      </View>

      {aviso && <Aviso aviso={aviso} />}

      {fase.poses.length === 0 ? (
        <Text className="font-body text-md text-foreground-muted">
          Seu treinador ainda não definiu as poses das fotos.
        </Text>
      ) : (
        fase.poses.map((pose, indice) => (
          <CartaoPose
            key={pose.id}
            estado={estados[pose.id] ?? { tipo: 'vazia' }}
            indice={indice}
            pose={pose}
            total={fase.poses.length}
            onEscolher={() => {
              escolher(pose.id);
            }}
            onTentarDeNovo={() => {
              tentarDeNovo(pose.id);
            }}
            onTirar={() => {
              tirar(pose.id);
            }}
          />
        ))
      )}

      {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
      <View style={{ height: bottom }} />
    </ScrollView>
  );
}

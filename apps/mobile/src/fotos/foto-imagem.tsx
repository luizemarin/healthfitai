import { useState } from 'react';

import { Image, Pressable, Text, View } from 'react-native';

import type { ReactElement } from 'react';

interface FotoImagemProps {
  uri: string;
  descricao: string;
  /** Busca a lista de novo (URLs novas). Mostra "Recarregar fotos" no aviso. */
  onRecarregar?: () => void;
}

/**
 * Foto vinda do storage, sempre em retrato (3:4). As URLs são assinadas e valem poucos minutos
 * (BE-FOT-04): se a imagem não abrir (URL expirou, storage fora), mostra um aviso amigável no
 * lugar da imagem quebrada, com a opção de buscar URLs novas (igual ao painel web).
 *
 * iOS e Android iguais: `fadeDuration={0}` (o Android faz fade de 300 ms por padrão; o iOS não).
 */
export function FotoImagem({ uri, descricao, onRecarregar }: FotoImagemProps): ReactElement {
  // Guarda QUAL url falhou: com uma url nova (após recarregar), tenta exibir de novo.
  const [uriComErro, setUriComErro] = useState<string | null>(null);

  if (uriComErro === uri) {
    return (
      <View
        accessibilityRole="alert"
        className="w-full items-center justify-center gap-xs rounded-sm border border-border bg-background p-sm"
        style={{ aspectRatio: 3 / 4 }}
      >
        <Text className="text-center font-body text-xs text-foreground-muted">
          Não foi possível exibir a foto.
        </Text>
        {onRecarregar && (
          <Pressable
            accessibilityRole="button"
            className="p-xs active:opacity-70"
            onPress={onRecarregar}
          >
            <Text className="text-center font-body-strong text-xs text-primary">
              Recarregar fotos
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={descricao}
      className="w-full rounded-sm bg-background"
      fadeDuration={0}
      resizeMode="cover"
      source={{ uri }}
      style={{ aspectRatio: 3 / 4 }}
      onError={() => {
        console.warn('[fotos] Não foi possível exibir a foto (URL expirada ou storage fora).');
        setUriComErro(uri);
      }}
    />
  );
}

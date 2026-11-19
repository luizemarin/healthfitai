import { Text, View } from 'react-native';

import { dataCurta, hora } from '../utils/datas';

import type { ReactElement } from 'react';

import type { ComentarioFeedback } from './feedbacks-api';

/**
 * MB-FBK-03 · Comentários do profissional no feedback, do mais antigo ao mais novo (ordem da API).
 * Nada é sobrescrito no back: uma correção do treinador chega como um comentário novo.
 */
export function Comentarios({
  comentarios,
}: {
  comentarios: readonly ComentarioFeedback[];
}): ReactElement {
  return (
    <View className="gap-md">
      <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
        Comentários do treinador
      </Text>

      {comentarios.length === 0 ? (
        <Text className="font-body text-md text-foreground-muted">
          Seu treinador ainda não comentou este feedback.
        </Text>
      ) : (
        comentarios.map((comentario) => (
          <View
            key={comentario.id}
            className="gap-xs rounded-md border border-border bg-surface p-md"
          >
            <Text className="font-body text-md text-foreground">{comentario.texto}</Text>
            <Text className="font-body text-xs text-foreground-muted">
              {dataCurta(comentario.criadoEm)} às {hora(comentario.criadoEm)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

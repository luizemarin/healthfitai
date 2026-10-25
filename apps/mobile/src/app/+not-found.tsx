import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import type { ReactElement } from 'react';

/** Rota inexistente (ex.: deep link antigo ou digitado errado). */
export default function NotFoundScreen(): ReactElement {
  return (
    <View className="flex-1 justify-center gap-md p-lg">
      <Text className="font-heading text-xl text-foreground">Tela não encontrada</Text>
      <Link asChild href="/">
        <Text className="font-body-strong text-md text-foreground underline">Voltar ao início</Text>
      </Link>
    </View>
  );
}

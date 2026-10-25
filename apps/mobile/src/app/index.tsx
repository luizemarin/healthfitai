import { useState } from 'react';

import { Text, View } from 'react-native';

import { signOut } from '../auth/auth';
import { Button } from '../components/button';

import type { ReactElement } from 'react';

export default function HomeScreen(): ReactElement {
  const [leaving, setLeaving] = useState(false);

  return (
    <View className="flex-1 justify-center gap-sm p-lg">
      <Text className="font-heading text-xxl text-foreground">Área do aluno</Text>
      <Text className="font-body text-md text-foreground-muted">
        Seu acompanhamento começa aqui.
      </Text>

      <View className="mt-xl">
        <Button
          label="Sair"
          loading={leaving}
          variant="secondary"
          onPress={() => {
            setLeaving(true);
            // Os tokens somem na hora; o guard do _layout volta para o login.
            signOut().catch(() => {});
          }}
        />
      </View>
    </View>
  );
}

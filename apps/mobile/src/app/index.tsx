import { useState } from 'react';

import { router } from 'expo-router';
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

      <View className="mt-xl gap-sm">
        <Button
          label="Preencher anamnese"
          onPress={() => {
            router.push('/anamnese');
          }}
        />
        <Button
          label="Meus feedbacks"
          onPress={() => {
            router.push('/feedbacks');
          }}
        />
        <Button
          label="Enviar fotos"
          onPress={() => {
            router.push('/fotos/enviar');
          }}
        />
        <Button
          label="Minhas fotos"
          onPress={() => {
            router.push('/fotos');
          }}
        />
        <Button
          label="Registrar peso e medidas"
          onPress={() => {
            router.push('/evolucao/registrar');
          }}
        />
        <Button
          label="Minha evolução"
          onPress={() => {
            router.push('/evolucao');
          }}
        />
        <Button
          label="Meus treinos"
          onPress={() => {
            router.push('/treinos');
          }}
        />
        <Button
          label="Plano nutricional"
          onPress={() => {
            router.push('/nutricao');
          }}
        />
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

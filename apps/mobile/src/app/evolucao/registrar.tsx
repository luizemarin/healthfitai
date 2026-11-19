import { useEffect } from 'react';

import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/button';
import { ErrorScreen } from '../../components/error-screen';
import { CAMPO_PESO, useRegistro } from '../../evolucao/use-registro';
import { colors } from '../../theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';
import type { ReactElement } from 'react';

import type { Aviso } from '../../evolucao/use-registro';

/** Se esta tela quebrar ao renderizar, o aluno vê a mensagem amigável daqui. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): ReactElement {
  useEffect(() => {
    console.error('[evolucao] Falha ao renderizar o registro de peso e medidas.', error);
  }, [error]);

  return (
    <ErrorScreen
      title="Não conseguimos abrir o registro de peso e medidas"
      onRetry={() => {
        retry().catch(() => {
          router.replace('/');
        });
      }}
    />
  );
}

interface CampoNumeroProps {
  rotulo: string;
  unidade: string;
  valor: string;
  erro: string | undefined;
  onChange: (texto: string) => void;
}

/** Campo numérico com a unidade ao lado (ex.: "Cintura · cm"). */
function CampoNumero({ rotulo, unidade, valor, erro, onChange }: CampoNumeroProps): ReactElement {
  return (
    <View className="gap-xs">
      <Text className="font-body-strong text-md text-foreground">{rotulo}</Text>
      <View className="flex-row items-center gap-sm">
        <TextInput
          accessibilityHint={`Em ${unidade}`}
          accessibilityLabel={rotulo}
          className={`min-h-12 flex-1 rounded-md border bg-surface px-md py-sm font-numeric text-md text-foreground ${erro ? 'border-danger' : 'border-border'}`}
          // "decimal-pad" existe nos dois sistemas; a vírgula ou o ponto que cada teclado mostra
          // são aceitos (lerNumero troca vírgula por ponto).
          keyboardType="decimal-pad"
          maxLength={8}
          placeholderTextColor={colors.textMuted}
          value={valor}
          onChangeText={onChange}
        />
        <Text className="w-10 font-body text-md text-foreground-muted">{unidade}</Text>
      </View>
      {erro && (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
          {erro}
        </Text>
      )}
    </View>
  );
}

function MensagemAviso({ aviso }: { aviso: NonNullable<Aviso> }): ReactElement {
  return (
    <Text
      accessibilityLiveRegion="polite"
      className={`font-body-strong text-md ${aviso.tipo === 'erro' ? 'text-danger' : 'text-foreground'}`}
    >
      {aviso.mensagem}
    </Text>
  );
}

/**
 * MB-EVO-01 · Registrar peso e medidas (/evolucao/registrar): formulário rápido com o peso e as
 * medidas pedidas pelo treinador, registrados com a data de hoje. Preenche só o que mediu.
 */
export default function RegistrarScreen(): ReactElement {
  const { fase, valores, erros, aviso, salvando, alterar, salvar, recarregar } = useRegistro();
  const alturaHeader = useHeaderHeight();
  const { bottom } = useSafeAreaInsets();

  if (fase.tipo === 'carregando') {
    return (
      <View
        accessibilityLabel="Carregando o registro de peso e medidas"
        className="flex-1 items-center justify-center gap-md p-lg"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="font-body text-md text-foreground-muted">Carregando…</Text>
      </View>
    );
  }

  if (fase.tipo === 'erro') {
    return (
      <ErrorScreen
        message={fase.mensagem}
        title="Não conseguimos abrir o registro de peso e medidas"
        // Sem cadastro no aparelho, tentar de novo não muda nada: o botão não aparece.
        {...(fase.podeTentarDeNovo && { onRetry: recarregar })}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      // Mesmo padrão do login e do questionário: no iOS a tela sobe com o teclado; no Android o
      // sistema já redimensiona a janela. O offset desconta o header.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
      keyboardVerticalOffset={alturaHeader}
    >
      <ScrollView
        contentContainerClassName="gap-lg p-lg"
        // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
        contentInsetAdjustmentBehavior="never"
        // O teclado numérico do iOS não tem botão de fechar: arrastar a lista fecha (nos dois).
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-body text-md text-foreground-muted">
          Preencha só o que você mediu. Os valores são registrados com a data de hoje.
        </Text>

        <CampoNumero
          erro={erros[CAMPO_PESO]}
          rotulo="Peso"
          unidade="kg"
          valor={valores[CAMPO_PESO] ?? ''}
          onChange={(texto) => {
            alterar(CAMPO_PESO, texto);
          }}
        />

        {fase.tipos.length > 0 && (
          <View className="gap-md border-t border-border pt-lg">
            <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
              Medidas
            </Text>
            {fase.tipos.map((tipo) => (
              <CampoNumero
                key={tipo.id}
                erro={erros[tipo.id]}
                rotulo={tipo.nome}
                unidade={tipo.unidade}
                valor={valores[tipo.id] ?? ''}
                onChange={(texto) => {
                  alterar(tipo.id, texto);
                }}
              />
            ))}
          </View>
        )}

        {aviso && <MensagemAviso aviso={aviso} />}
        <Button label="Salvar" loading={salvando} onPress={salvar} />

        {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
        <View style={{ height: bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

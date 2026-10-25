import { useState } from 'react';

import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { ApiError } from '../api/api-error';
import { signIn } from '../auth/auth';
import { Button } from '../components/button';
import { colors } from '../theme/tokens';

import type { ReactElement } from 'react';

/** Converte o erro do login numa frase que o aluno entende. */
function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    }
    if (error.status === 401) {
      return 'E-mail ou senha incorretos.';
    }
    if (error.status === 400 || error.status === 422) {
      return error.message;
    }
  }
  return 'Não foi possível entrar agora. Tente de novo em instantes.';
}

const inputClass =
  'mb-sm min-h-12 rounded-md border border-border bg-surface px-md font-body text-md text-foreground';

/** Login do aluno. Ao entrar, o guard do _layout leva para a área do aluno sozinho. */
export default function LoginScreen(): ReactElement {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!email.trim() || !senha) {
      setError('Informe e-mail e senha.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), senha);
    } catch (err) {
      setError(loginErrorMessage(err));
      setLoading(false);
    }
  }

  const submit = (): void => {
    handleSubmit().catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-center gap-xl bg-background p-lg"
    >
      <View className="gap-sm">
        <Text className="font-heading text-xxl text-foreground">Entrar</Text>
        <Text className="font-body text-md text-foreground-muted">Acesse seu acompanhamento.</Text>
      </View>

      <View className="gap-sm">
        <Text className="font-body-strong text-sm text-foreground">E-mail</Text>
        <TextInput
          accessibilityLabel="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          className={inputClass}
          editable={!loading}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="voce@email.com"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          textContentType="username"
          value={email}
        />

        <Text className="font-body-strong text-sm text-foreground">Senha</Text>
        <TextInput
          accessibilityLabel="Senha"
          autoCapitalize="none"
          autoComplete="current-password"
          className={inputClass}
          editable={!loading}
          onChangeText={setSenha}
          onSubmitEditing={submit}
          placeholder="Sua senha"
          placeholderTextColor={colors.textMuted}
          returnKeyType="go"
          secureTextEntry
          textContentType="password"
          value={senha}
        />

        {error && (
          <Text
            accessibilityLiveRegion="polite"
            className="font-body-strong text-sm text-foreground"
          >
            {error}
          </Text>
        )}

        <Button label="Entrar" loading={loading} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

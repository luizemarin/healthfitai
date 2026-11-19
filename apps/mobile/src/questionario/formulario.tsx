import { useRef, useState } from 'react';

import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoPergunta } from './campo-pergunta';
import { Button } from '../components/button';
import { spacing } from '../theme/tokens';
import { hora } from '../utils/datas';

import type { ReactElement } from 'react';
import type { ScrollViewInstance } from 'react-native';

import type { Submissao } from './submissoes-api';
import type { Questionario, Salvamento } from './use-questionario';

/** Situação do autosave (MB-ANA-02). Na falha, avisa que nada se perdeu e deixa tentar de novo. */
function StatusSalvamento({
  salvamento,
  onTentarDeNovo,
}: {
  salvamento: Salvamento;
  onTentarDeNovo: () => void;
}): ReactElement | null {
  switch (salvamento.status) {
    case 'salvando':
      return <Text className="font-body text-sm text-foreground-muted">Salvando rascunho…</Text>;

    case 'salvo':
      return (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-foreground-muted">
          Rascunho salvo automaticamente às {hora(salvamento.em)}
        </Text>
      );

    case 'falhou':
      return (
        <View accessibilityLiveRegion="polite" className="gap-xs">
          <Text className="font-body-strong text-sm text-danger">{salvamento.mensagem}</Text>
          <Text className="font-body text-sm text-foreground-muted">
            Suas respostas estão guardadas neste aparelho.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-12 justify-center self-start active:opacity-70"
            onPress={onTentarDeNovo}
          >
            <Text className="font-body-strong text-sm text-foreground underline">
              Tentar salvar agora
            </Text>
          </Pressable>
        </View>
      );

    default:
      return null;
  }
}

interface FormularioProps {
  questionario: Questionario;
  submissao: Submissao;
  /** Texto do botão de envio (ex.: "Enviar anamnese"). */
  labelEnviar: string;
  /** Para onde vai depois de "Salvar e continuar depois". */
  onSair: () => void;
}

/**
 * Formulário de um questionário do aluno (anamnese, feedback): perguntas, autosave e envio.
 * A regra fica em use-questionario.ts; aqui só a tela.
 */
export function Formulario({
  questionario,
  submissao,
  labelEnviar,
  onSair,
}: FormularioProps): ReactElement {
  const scroll = useRef<ScrollViewInstance>(null);
  // Posição de cada pergunta na lista, para rolar até a primeira com erro.
  const posicoes = useRef<Record<string, number>>({});
  const alturaHeader = useHeaderHeight();
  const { bottom } = useSafeAreaInsets();
  const [saindo, setSaindo] = useState(false);

  const enviar = async (): Promise<void> => {
    const primeiraComErro = await questionario.enviar();
    const y = primeiraComErro ? posicoes.current[primeiraComErro] : undefined;
    if (y !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
    }
  };

  const continuarDepois = (): void => {
    setSaindo(true);
    // salvarAgora nunca falha: sem internet, as respostas ficam no aparelho.
    questionario
      .salvarAgora()
      .catch(() => {})
      .finally(onSair);
  };

  return (
    <KeyboardAvoidingView
      // Mesmo padrão do login: no iOS a tela sobe com o teclado; no Android o sistema já
      // redimensiona a janela. O offset desconta o header, para o campo não ficar escondido.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
      keyboardVerticalOffset={alturaHeader}
    >
      <ScrollView
        ref={scroll}
        contentContainerClassName="gap-lg p-lg"
        // iOS ajusta o conteúdo sozinho por baixo das barras; o Android não. Desligado = igual.
        contentInsetAdjustmentBehavior="never"
        // O teclado numérico do iOS não tem botão de fechar: arrastar a lista fecha (nos dois).
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-sm">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            {submissao.modelo.nome}
          </Text>
          <Text className="font-body text-md text-foreground-muted">
            Responda com calma. Suas respostas são salvas automaticamente: você pode sair e
            continuar depois de onde parou.
          </Text>
          <Text className="font-body text-sm text-foreground-muted">
            Perguntas com <Text className="text-danger">*</Text> são obrigatórias.
          </Text>
          <StatusSalvamento
            salvamento={questionario.salvamento}
            onTentarDeNovo={() => {
              questionario.salvarAgora().catch(() => {});
            }}
          />
        </View>

        {submissao.perguntas.map((pergunta) => (
          <View
            key={pergunta.id}
            className="border-t border-border pt-lg"
            onLayout={(event) => {
              posicoes.current[pergunta.id] = event.nativeEvent.layout.y;
            }}
          >
            <CampoPergunta
              erro={questionario.erros[pergunta.id]}
              pergunta={pergunta}
              valor={questionario.valores[pergunta.id] ?? null}
              onChange={(valor) => {
                questionario.alterar(pergunta.id, valor);
              }}
            />
          </View>
        ))}

        <View className="gap-sm border-t border-border pt-lg">
          {questionario.aviso && (
            <Text accessibilityLiveRegion="polite" className="font-body-strong text-sm text-danger">
              {questionario.aviso}
            </Text>
          )}
          <Button
            label={labelEnviar}
            loading={questionario.enviando}
            onPress={() => {
              enviar().catch(() => {});
            }}
          />
          <Button
            label="Salvar e continuar depois"
            loading={saindo}
            variant="secondary"
            onPress={continuarDepois}
          />
        </View>

        {/* Área da barra de gestos/navegação: iOS e Android (edge-to-edge) informam pelo inset. */}
        <View style={{ height: bottom }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

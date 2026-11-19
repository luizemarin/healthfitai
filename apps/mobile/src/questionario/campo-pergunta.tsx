import { Pressable, Text, TextInput, View } from 'react-native';

import { mascararData, MAX_TEXTO_CURTO, MAX_TEXTO_LONGO, numeroBr } from './valores';
import { colors } from '../theme/tokens';

import type { ReactElement } from 'react';
import type { TextInputProps } from 'react-native';

import type { PerguntaRespondida } from './submissoes-api';
import type { ValorCampo } from './valores';

/** Escala com até 11 valores (ex.: 0 a 10) vira botões; maior que isso, campo numérico. */
const ESCALA_MAX_BOTOES = 11;

interface CampoPerguntaProps {
  pergunta: PerguntaRespondida;
  valor: ValorCampo;
  erro?: string | undefined;
  onChange: (valor: ValorCampo) => void;
}

/**
 * Uma pergunta do questionário (anamnese ou feedback), desenhada conforme o tipo (BE-QST-02).
 *
 * Tudo feito com componentes básicos (View, Text, Pressable, TextInput) e as cores do tema, em vez
 * de seletores nativos (radio, checkbox, date picker), que têm aparência e comportamento diferentes
 * no iOS e no Android. Assim a tela é igual nos dois.
 */
export function CampoPergunta({
  pergunta,
  valor,
  erro,
  onChange,
}: CampoPerguntaProps): ReactElement {
  const titulo = `${String(pergunta.ordem)}. ${pergunta.enunciado}`;
  const dica = dicaNumero(pergunta);

  return (
    <View className="gap-sm">
      <Text
        accessibilityLabel={pergunta.obrigatoria ? `${titulo}, obrigatória` : titulo}
        className="font-body-strong text-md text-foreground"
      >
        {titulo}
        {pergunta.obrigatoria && <Text className="text-danger"> *</Text>}
      </Text>
      {dica && <Text className="font-body text-sm text-foreground-muted">{dica}</Text>}

      <Entrada erro={erro} onChange={onChange} pergunta={pergunta} valor={valor} />

      {erro && (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
          {erro}
        </Text>
      )}
    </View>
  );
}

/** O campo em si, conforme o tipo da pergunta. */
function Entrada({ pergunta, valor, erro, onChange }: CampoPerguntaProps): ReactElement {
  const texto = typeof valor === 'string' ? valor : '';
  const comErro = Boolean(erro);

  switch (pergunta.tipo) {
    case 'escolha_unica':
      return (
        <View accessibilityRole="radiogroup" className="gap-sm">
          {(pergunta.opcoes ?? []).map((opcao) => (
            <Opcao
              key={opcao}
              label={opcao}
              marcada={valor === opcao}
              tipo="radio"
              // Tocar de novo na opção marcada desmarca (apaga a resposta).
              onPress={() => onChange(valor === opcao ? null : opcao)}
            />
          ))}
        </View>
      );

    case 'multipla_escolha': {
      const marcadas = Array.isArray(valor) ? valor : [];
      return (
        <View className="gap-sm">
          {(pergunta.opcoes ?? []).map((opcao) => {
            const marcada = marcadas.includes(opcao);
            return (
              <Opcao
                key={opcao}
                label={opcao}
                marcada={marcada}
                tipo="checkbox"
                onPress={() =>
                  onChange(
                    marcada ? marcadas.filter((item) => item !== opcao) : [...marcadas, opcao],
                  )
                }
              />
            );
          })}
        </View>
      );
    }

    case 'sim_nao':
      return (
        <View accessibilityRole="radiogroup" className="flex-row gap-sm">
          {[
            { label: 'Sim', resposta: true },
            { label: 'Não', resposta: false },
          ].map(({ label, resposta }) => (
            <View key={label} className="flex-1">
              <Opcao
                label={label}
                marcada={valor === resposta}
                tipo="radio"
                onPress={() => onChange(valor === resposta ? null : resposta)}
              />
            </View>
          ))}
        </View>
      );

    case 'escala':
      if (usaBotoes(pergunta)) {
        return <BotoesEscala pergunta={pergunta} valor={texto} onChange={onChange} />;
      }
      return (
        <CampoTexto
          comErro={comErro}
          keyboardType="number-pad"
          value={texto}
          onChangeText={onChange}
        />
      );

    case 'numero':
      return (
        // "decimal-pad" existe nos dois sistemas; a vírgula ou o ponto que cada teclado mostra são
        // aceitos (valorParaApi troca vírgula por ponto).
        <CampoTexto
          comErro={comErro}
          keyboardType="decimal-pad"
          value={texto}
          onChangeText={onChange}
        />
      );

    case 'data':
      return (
        <CampoTexto
          comErro={comErro}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="DD/MM/AAAA"
          value={texto}
          onChangeText={(digitado) => onChange(mascararData(digitado))}
        />
      );

    case 'texto_longo':
      return (
        <CampoTexto
          comErro={comErro}
          maxLength={MAX_TEXTO_LONGO}
          multiline
          value={texto}
          onChangeText={onChange}
        />
      );

    default:
      // texto_curto
      return (
        <CampoTexto
          comErro={comErro}
          maxLength={MAX_TEXTO_CURTO}
          value={texto}
          onChangeText={onChange}
        />
      );
  }
}

interface CampoTextoProps extends Omit<TextInputProps, 'className' | 'style'> {
  comErro: boolean;
}

const inputClass =
  'min-h-12 rounded-md border bg-surface px-md py-sm font-body text-md text-foreground';

function CampoTexto({ comErro, multiline = false, ...props }: CampoTextoProps): ReactElement {
  return (
    <TextInput
      className={`${inputClass} ${comErro ? 'border-danger' : 'border-border'} ${multiline ? 'min-h-32' : ''}`}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      // Android centraliza o texto do campo multilinha na vertical; o iOS começa no topo.
      // Fixado no topo para ficar igual nos dois.
      style={multiline ? { textAlignVertical: 'top' } : undefined}
      {...props}
    />
  );
}

interface OpcaoProps {
  tipo: 'radio' | 'checkbox';
  label: string;
  marcada: boolean;
  onPress: () => void;
}

/** Opção tocável com o indicador desenhado (círculo para radio, quadrado para checkbox). */
function Opcao({ tipo, label, marcada, onPress }: OpcaoProps): ReactElement {
  const formato = tipo === 'radio' ? 'rounded-pill' : 'rounded-none';

  return (
    <Pressable
      accessibilityRole={tipo}
      accessibilityState={{ checked: marcada }}
      className={`min-h-12 flex-row items-center gap-sm rounded-md border px-md py-sm active:opacity-70 ${marcada ? 'border-primary bg-surface' : 'border-border'}`}
      onPress={onPress}
    >
      <View
        className={`h-5 w-5 items-center justify-center border-2 ${formato} ${marcada ? 'border-primary' : 'border-foreground-muted'}`}
      >
        {marcada && <View className={`h-2.5 w-2.5 bg-primary ${formato}`} />}
      </View>
      <Text className="flex-1 font-body text-md text-foreground">{label}</Text>
    </Pressable>
  );
}

function usaBotoes({ min, max }: PerguntaRespondida): boolean {
  return min !== null && max !== null && max - min + 1 <= ESCALA_MAX_BOTOES;
}

/** Escala curta: um botão por valor (ex.: 0 a 10). Tocar de novo no marcado desmarca. */
function BotoesEscala({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: PerguntaRespondida;
  valor: string;
  onChange: (valor: ValorCampo) => void;
}): ReactElement {
  const min = pergunta.min ?? 0;
  const max = pergunta.max ?? 0;
  const numeros = Array.from({ length: max - min + 1 }, (_, indice) => String(min + indice));

  return (
    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-sm">
      {numeros.map((numero) => {
        const marcado = valor === numero;
        return (
          <Pressable
            key={numero}
            accessibilityLabel={numero}
            accessibilityRole="radio"
            accessibilityState={{ checked: marcado }}
            className={`h-12 min-w-12 items-center justify-center rounded-md border px-sm active:opacity-70 ${marcado ? 'border-primary bg-primary' : 'border-border bg-surface'}`}
            onPress={() => onChange(marcado ? null : numero)}
          >
            <Text
              className={`font-numeric text-md ${marcado ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {numero}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "De 0 a 10 · Em kg": só o que a pergunta tiver. */
function dicaNumero({ tipo, min, max, unidade }: PerguntaRespondida): string | null {
  if (tipo !== 'numero' && tipo !== 'escala') {
    return null;
  }
  const partes = [
    min !== null && max !== null ? `De ${numeroBr(min)} a ${numeroBr(max)}` : null,
    min !== null && max === null ? `Mínimo ${numeroBr(min)}` : null,
    max !== null && min === null ? `Máximo ${numeroBr(max)}` : null,
    unidade ? `Em ${unidade}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

import { Pressable, Text, TextInput, View } from 'react-native';

import { prescricao } from './treinos-formato';
import { chaveDaSerie, SERIE_VAZIA } from './use-execucao';
import { numeroBr } from '../questionario/valores';
import { colors } from '../theme/tokens';

import type { ReactElement } from 'react';

import type { ItemTreino } from './treinos-api';
import type { Serie } from './use-execucao';

type Campo = 'repeticoes' | 'carga';

interface LinhaSerieProps {
  numero: number;
  nomeExercicio: string;
  serie: Serie;
  erro: string | undefined;
  /** O que o treinador pediu, como dica no campo vazio (ex.: "8-12", "40"). */
  dicaRepeticoes: string;
  dicaCarga: string;
  onAlterar: (campo: Campo, texto: string) => void;
  onAlternar: () => void;
}

const CAMPO =
  'min-h-12 flex-1 rounded-md border bg-background px-md py-sm font-numeric text-md text-foreground';

/** MB-TRE-02 · Uma série: repetições feitas, carga (kg) e o "feita". */
function LinhaSerie({
  numero,
  nomeExercicio,
  serie,
  erro,
  dicaRepeticoes,
  dicaCarga,
  onAlterar,
  onAlternar,
}: LinhaSerieProps): ReactElement {
  const borda = erro ? 'border-danger' : 'border-border';
  const daSerie = `da série ${String(numero)} de ${nomeExercicio}`;

  return (
    <View className="gap-xs">
      <View className="flex-row items-center gap-sm">
        <Text className="w-10 font-numeric text-md text-foreground">{numero}</Text>
        <TextInput
          accessibilityLabel={`Repetições ${daSerie}`}
          className={`${CAMPO} ${borda}`}
          // "number-pad" e "decimal-pad" existem nos dois sistemas (sem teclado diferente por SO).
          keyboardType="number-pad"
          maxLength={4}
          placeholder={dicaRepeticoes}
          placeholderTextColor={colors.textMuted}
          value={serie.repeticoes}
          onChangeText={(texto) => {
            onAlterar('repeticoes', texto);
          }}
        />
        <TextInput
          accessibilityHint="Em quilos. Deixe vazio se não usou carga."
          accessibilityLabel={`Carga ${daSerie}`}
          className={`${CAMPO} ${borda}`}
          keyboardType="decimal-pad"
          maxLength={7}
          placeholder={dicaCarga}
          placeholderTextColor={colors.textMuted}
          value={serie.carga}
          onChangeText={(texto) => {
            onAlterar('carga', texto);
          }}
        />
        {/* Caixa desenhada aqui (não o checkbox nativo, que muda entre iOS e Android). */}
        <Pressable
          accessibilityLabel={`Série ${String(numero)} de ${nomeExercicio} feita`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: serie.concluida }}
          className={`h-12 w-12 items-center justify-center rounded-md border active:opacity-70 ${serie.concluida ? 'border-primary bg-primary' : 'border-border'}`}
          onPress={onAlternar}
        >
          {serie.concluida && (
            <Text className="font-body-strong text-lg text-primary-foreground">✓</Text>
          )}
        </Pressable>
      </View>
      {erro && (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-danger">
          {erro}
        </Text>
      )}
    </View>
  );
}

interface CartaoExercicioProps {
  item: ItemTreino;
  posicao: number;
  total: number;
  series: Record<string, Serie | undefined>;
  erros: Record<string, string | undefined>;
  onAlterar: (chave: string, campo: Campo, texto: string) => void;
  onAlternar: (item: ItemTreino, numero: number) => void;
}

/** MB-TRE-01 · Um exercício da lista vertical: o que o treinador pediu e uma linha por série. */
export function CartaoExercicio({
  item,
  posicao,
  total,
  series,
  erros,
  onAlterar,
  onAlternar,
}: CartaoExercicioProps): ReactElement {
  const numeros = Array.from({ length: item.series }, (_, indice) => indice + 1);
  const dicaCarga = item.cargaKg === null ? '—' : numeroBr(item.cargaKg);

  return (
    <View className="gap-md rounded-md border border-border bg-surface p-md">
      <View className="gap-xs">
        <Text className="font-body text-sm text-foreground-muted">
          {`Exercício ${String(posicao)} de ${String(total)} · ${item.exercicio.grupoMuscular}`}
        </Text>
        <Text accessibilityRole="header" className="font-heading text-lg text-foreground">
          {item.exercicio.nome}
        </Text>
        <Text className="font-body text-sm text-foreground-muted">{prescricao(item)}</Text>
      </View>

      <View
        accessibilityElementsHidden
        className="flex-row gap-sm"
        importantForAccessibility="no-hide-descendants"
      >
        <Text className="w-10 font-body text-xs text-foreground-muted">Série</Text>
        <Text className="flex-1 font-body text-xs text-foreground-muted">Repetições</Text>
        <Text className="flex-1 font-body text-xs text-foreground-muted">Carga (kg)</Text>
        <Text className="w-12 text-center font-body text-xs text-foreground-muted">Feita</Text>
      </View>

      {numeros.map((numero) => {
        const chave = chaveDaSerie(item.exercicio.id, numero);
        return (
          <LinhaSerie
            key={chave}
            dicaCarga={dicaCarga}
            dicaRepeticoes={item.repeticoes}
            erro={erros[chave]}
            nomeExercicio={item.exercicio.nome}
            numero={numero}
            serie={series[chave] ?? SERIE_VAZIA}
            onAlterar={(campo, texto) => {
              onAlterar(chave, campo, texto);
            }}
            onAlternar={() => {
              onAlternar(item, numero);
            }}
          />
        );
      })}
    </View>
  );
}

import { numeroBr } from '../questionario/valores';

import type { ItemTreino } from './treinos-api';

/**
 * Textos e números do treino para o aluno (pt-BR).
 *
 * Mensagens do back escritas para o profissional ("…na sua biblioteca") trocadas por frases para o
 * aluno. As demais vão como vêm (ex.: "Treino não encontrado.").
 */
export const PARA_O_ALUNO = {
  EXERCICIO_NAO_ENCONTRADO:
    'Um dos exercícios deste treino não está mais disponível. Fale com seu treinador.',
} as const;

export const FALHA_PADRAO = 'Pode ter sido uma falha momentânea. Tente de novo em instantes.';

/** Reenvio do mesmo treino (mesmo início): o back já tinha registrado e não duplicou. */
export const JA_REGISTRADO = 'EXECUCAO_JA_REGISTRADA';

export const REPETICOES_INVALIDAS = 'Informe as repetições feitas, só números (ex.: 10).';
export const CARGA_INVALIDA = 'Informe a carga só com números (ex.: 42,5) ou deixe vazio.';
export const SEM_SERIES = 'Conclua pelo menos uma série antes de finalizar o treino.';
export const CONFIRA_AS_SERIES = 'Confira as séries destacadas.';

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');

/** Segundos → "MM:SS" (ou "H:MM:SS" a partir de 1 hora). Montado à mão: igual no iOS e no Android. */
export function duracao(totalSegundos: number): string {
  const total = Math.max(0, Math.floor(totalSegundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const mmss = `${doisDigitos(minutos)}:${doisDigitos(total % 60)}`;
  return horas > 0 ? `${String(horas)}:${mmss}` : mmss;
}

/** O que o treinador pediu: "4 séries de 8-12 · 40 kg · descanso 01:30". */
export function prescricao({ series, repeticoes, cargaKg, descansoSegundos }: ItemTreino): string {
  const partes = [`${String(series)} ${series === 1 ? 'série' : 'séries'} de ${repeticoes}`];
  if (cargaKg !== null) {
    partes.push(`${numeroBr(cargaKg)} kg`);
  }
  if (descansoSegundos > 0) {
    partes.push(`descanso ${duracao(descansoSegundos)}`);
  }
  return partes.join(' · ');
}

/** Repetições digitadas → número inteiro. Vazio = null; texto que não é inteiro = NaN. */
export function lerRepeticoes(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === '') {
    return null;
  }
  return /^\d+$/.test(limpo) ? Number(limpo) : Number.NaN;
}

/** "1 treino" · "12 treinos" */
export function treinos(quantidade: number): string {
  return quantidade === 1 ? '1 treino' : `${String(quantidade)} treinos`;
}

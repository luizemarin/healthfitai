import { numeroBr } from '../questionario/valores';

/**
 * Textos e números da evolução para o aluno (pt-BR).
 *
 * Mensagens do back escritas para o profissional ("Ative o tipo ou escolha outro.") trocadas por
 * frases para o aluno. As demais vão como vêm (ex.: "O peso deve ser maior que zero.").
 */
export const PARA_O_ALUNO = {
  TIPO_MEDIDA_INATIVO:
    'Uma das medidas não é mais pedida pelo seu treinador. Volte e abra a tela de novo para ver as medidas atuais.',
} as const;

export const FALHA_PADRAO = 'Pode ter sido uma falha momentânea. Tente de novo em instantes.';

/**
 * Texto digitado → número. Aceita vírgula ou ponto (o teclado decimal mostra um ou outro conforme o
 * sistema e o idioma). Vazio = null; texto que não é número = NaN.
 */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === '') {
    return null;
  }
  // Number('') e Number(' ') dão 0; por isso o vazio sai antes. "1e3" não é como se digita peso.
  return /^\d+([.,]\d+)?$/.test(limpo) ? Number(limpo.replace(',', '.')) : Number.NaN;
}

export const NUMERO_INVALIDO = 'Informe só números, ex.: 72,5.';

/** "72,5 kg" · "18%" */
export function comUnidade(valor: number, unidade: string | null): string {
  if (!unidade) {
    return numeroBr(valor);
  }
  return unidade === '%' ? `${numeroBr(valor)}%` : `${numeroBr(valor)} ${unidade}`;
}

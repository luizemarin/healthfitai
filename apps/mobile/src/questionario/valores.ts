import type { PerguntaRespondida, RespostaInformada } from './submissoes-api';

/**
 * Valor de uma pergunta enquanto o aluno preenche (o que está na tela). Número e escala ficam
 * como texto (o que foi digitado, ex.: "72,5") e data como DD/MM/AAAA; só viram o formato da
 * API na hora de salvar.
 */
export type ValorCampo = string | string[] | boolean | null;

/** Mesmos limites de texto do back (respostas.valores.ts). */
export const MAX_TEXTO_CURTO = 500;
export const MAX_TEXTO_LONGO = 5000;

const DATA_API = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_TELA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Número no jeito brasileiro (vírgula), igual no iOS e no Android (sem depender do Intl). */
export function numeroBr(valor: number): string {
  return String(valor).replace('.', ',');
}

/** Valor que veio da API (rascunho retomado) → valor do campo. */
export function valorInicial({ tipo, valor }: PerguntaRespondida): ValorCampo {
  if (typeof valor === 'number') {
    return numeroBr(valor);
  }
  if (tipo === 'data' && typeof valor === 'string') {
    const [, ano, mes, dia] = DATA_API.exec(valor) ?? [];
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
  }
  return valor;
}

/**
 * Data enquanto o aluno digita: só números, com as barras no lugar (DD/MM/AAAA).
 * Campo de texto em vez do seletor nativo, que é bem diferente no iOS e no Android.
 */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  return [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)].filter(Boolean).join('/');
}

export type ResultadoValor = { valor: RespostaInformada['valor'] } | { erro: string };

/**
 * Valor do campo → valor enviado à API. Campo vazio vira null (apaga a resposta).
 *
 * Número inválido vai como texto: o back recusa com a mensagem dele ("Responda com um número."),
 * que aparece embaixo da pergunta. Só a data é conferida aqui, porque a tela usa DD/MM/AAAA e o
 * back AAAA-MM-DD (a mensagem dele citaria um formato que o aluno não digitou).
 */
export function valorParaApi(pergunta: PerguntaRespondida, valor: ValorCampo): ResultadoValor {
  const vazio =
    valor === null ||
    (typeof valor === 'string' && valor.trim() === '') ||
    (Array.isArray(valor) && valor.length === 0);
  if (vazio) {
    return { valor: null };
  }
  if (typeof valor !== 'string') {
    return { valor };
  }

  if (pergunta.tipo === 'numero' || pergunta.tipo === 'escala') {
    const numero = Number(valor.trim().replace(',', '.'));
    return { valor: Number.isFinite(numero) ? numero : valor };
  }
  if (pergunta.tipo === 'data') {
    const [, dia, mes, ano] = DATA_TELA.exec(valor.trim()) ?? [];
    return dia && mes && ano
      ? { valor: `${ano}-${mes}-${dia}` }
      : { erro: 'Informe a data no formato DD/MM/AAAA.' };
  }
  return { valor };
}

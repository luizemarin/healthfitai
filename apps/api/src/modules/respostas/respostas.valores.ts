import { LIMITE_NUMERICO } from '../questionarios/questionarios.schemas';

import type { ValorResposta } from './respostas.repository';
import type { Pergunta, TipoPergunta } from '../questionarios/questionarios.repository';

/**
 * Confere se o valor enviado combina com o tipo da pergunta (BE-QST-02) e
 * devolve o valor normalizado (ex.: texto sem espaços nas pontas) ou a
 * mensagem de erro para o front mostrar ao lado da pergunta.
 */
export type ResultadoValor = { valor: ValorResposta } | { erro: string };

type Validador = (valor: ValorResposta, pergunta: Pergunta) => ResultadoValor;

const MAX_TEXTO_CURTO = 500;
const MAX_TEXTO_LONGO = 5000;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function texto(maximo: number): Validador {
  return (valor) => {
    if (typeof valor !== 'string') {
      return { erro: 'Responda com um texto.' };
    }
    const limpo = valor.trim();
    if (limpo === '') {
      return { erro: 'A resposta não pode ficar vazia. Caso não queira responder, deixe a pergunta em branco.' };
    }
    if (limpo.length > maximo) {
      return { erro: `A resposta deve ter no máximo ${maximo} caracteres.` };
    }
    return { valor: limpo };
  };
}

/** Mensagem do intervalo permitido, considerando que min/max são opcionais em "numero". */
function foraDoIntervalo(valor: number, min: number | null, max: number | null): string | null {
  if (min !== null && max !== null && (valor < min || valor > max)) {
    return `O valor deve estar entre ${min} e ${max}.`;
  }
  if (min !== null && valor < min) {
    return `O valor deve ser no mínimo ${min}.`;
  }
  if (max !== null && valor > max) {
    return `O valor deve ser no máximo ${max}.`;
  }
  return null;
}

const numero: Validador = (valor, pergunta) => {
  if (typeof valor !== 'number') {
    return { erro: 'Responda com um número.' };
  }
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
    return { erro: 'O número aceita no máximo 2 casas decimais.' };
  }
  const erro =
    foraDoIntervalo(valor, pergunta.min, pergunta.max) ??
    foraDoIntervalo(valor, -LIMITE_NUMERICO, LIMITE_NUMERICO);
  return erro ? { erro } : { valor };
};

const escala: Validador = (valor, pergunta) => {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    return { erro: `Responda com um número inteiro de ${pergunta.min} a ${pergunta.max}.` };
  }
  const erro = foraDoIntervalo(valor, pergunta.min, pergunta.max);
  return erro ? { erro } : { valor };
};

const simNao: Validador = (valor) =>
  typeof valor === 'boolean' ? { valor } : { erro: 'Responda com verdadeiro (sim) ou falso (não).' };

const data: Validador = (valor) => {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) {
    return { erro: 'Informe a data no formato AAAA-MM-DD.' };
  }
  const dia = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== valor) {
    return { erro: 'Data inexistente.' };
  }
  return { valor };
};

function opcoesValidas(pergunta: Pergunta): string {
  return (pergunta.opcoes ?? []).join(', ');
}

const escolhaUnica: Validador = (valor, pergunta) => {
  if (typeof valor !== 'string') {
    return { erro: 'Selecione uma das opções.' };
  }
  const escolhida = valor.trim();
  if (!(pergunta.opcoes ?? []).includes(escolhida)) {
    return { erro: `Opção inválida. Selecione uma destas: ${opcoesValidas(pergunta)}.` };
  }
  return { valor: escolhida };
};

const multiplaEscolha: Validador = (valor, pergunta) => {
  if (!Array.isArray(valor)) {
    return { erro: 'Envie as opções escolhidas como uma lista de textos.' };
  }
  const escolhidas = valor.map((opcao) => opcao.trim());
  if (escolhidas.length === 0) {
    return { erro: 'Escolha pelo menos uma opção. Para apagar a resposta, envie null.' };
  }
  if (new Set(escolhidas).size !== escolhidas.length) {
    return { erro: 'A mesma opção foi escolhida mais de uma vez.' };
  }
  const invalidas = escolhidas.filter((opcao) => !(pergunta.opcoes ?? []).includes(opcao));
  if (invalidas.length > 0) {
    return {
      erro: `Opção inválida: ${invalidas.join(', ')}. Escolha entre: ${opcoesValidas(pergunta)}.`,
    };
  }
  return { valor: escolhidas };
};

const VALIDADORES: Record<TipoPergunta, Validador> = {
  texto_curto: texto(MAX_TEXTO_CURTO),
  texto_longo: texto(MAX_TEXTO_LONGO),
  escolha_unica: escolhaUnica,
  multipla_escolha: multiplaEscolha,
  sim_nao: simNao,
  numero,
  escala,
  data,
};

export function validarValor(pergunta: Pergunta, valor: ValorResposta): ResultadoValor {
  return VALIDADORES[pergunta.tipo](valor, pergunta);
}

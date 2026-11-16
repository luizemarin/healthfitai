import { ApiError } from '../../api/api-error';
import { formatarData } from '../alunos/aluno-formato';

import type { PerguntaRespondida, SexoAlvo, TipoModelo, TipoPergunta } from './questionarios-api';

/** Textos e formatos de exibição dos questionários (pt-BR). */

export const TIPO_MODELO_LABEL: Record<TipoModelo, string> = {
  anamnese: 'Anamnese',
  avaliacao: 'Avaliação',
  feedback: 'Feedback',
};

export const TIPOS_MODELO = Object.keys(TIPO_MODELO_LABEL) as TipoModelo[];

/** Mesmos tipos do back (BE-QST-02), na ordem em que aparecem no seletor. */
export const TIPO_PERGUNTA_LABEL: Record<TipoPergunta, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  escolha_unica: 'Escolha única',
  multipla_escolha: 'Múltipla escolha',
  sim_nao: 'Sim / Não',
  numero: 'Número',
  escala: 'Escala',
  data: 'Data',
};

export const TIPOS_PERGUNTA = Object.keys(TIPO_PERGUNTA_LABEL) as TipoPergunta[];

export function sexoAlvoLabel(sexo: SexoAlvo): string {
  if (sexo === 'masculino') return 'Masculino';
  if (sexo === 'feminino') return 'Feminino';
  return 'Qualquer sexo';
}

const numeroBr = (valor: number): string => valor.toLocaleString('pt-BR');

/** Valor de uma resposta como texto de leitura ("72,4 kg", "Sim", "A, B"…). */
export function formatarValor(pergunta: PerguntaRespondida): string | null {
  const { valor, tipo, unidade, min, max } = pergunta;
  if (valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)) {
    return null;
  }
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') {
    const comUnidade = unidade ? `${numeroBr(valor)} ${unidade}` : numeroBr(valor);
    return tipo === 'escala' && min !== null && max !== null
      ? `${comUnidade} (de ${numeroBr(min)} a ${numeroBr(max)})`
      : comUnidade;
  }
  return tipo === 'data' ? formatarData(valor) : valor;
}

/**
 * Mensagem do back para o erro, quando ela foi escrita para o usuário
 * (ex.: "Este modelo foi alterado depois que você o abriu…").
 * Sem conexão, sessão expirada e falha do servidor ficam com o texto amigável padrão.
 */
export function mensagemDaApi(error: unknown): string | undefined {
  const escritaParaUsuario =
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401 &&
    error.code !== 'ROUTE_NOT_FOUND' &&
    error.code !== 'UNEXPECTED_ERROR';
  return escritaParaUsuario ? error.message : undefined;
}

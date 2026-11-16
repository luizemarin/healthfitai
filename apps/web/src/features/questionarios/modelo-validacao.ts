import type { Modelo, PerguntaEntrada, TipoModelo, TipoPergunta } from './questionarios-api';
import type { ApiErrorDetail } from '../../api/api-error';

/**
 * Formulário do modelo e validação — mesmas regras do back
 * (apps/api/src/modules/questionarios/questionarios.schemas.ts). Mudou lá? Ajuste aqui.
 *
 *   nome        obrigatório, 2 a 120 caracteres
 *   tipo        obrigatório na criação (não muda depois)
 *   perguntas   1 a 100; a ordem é a posição na lista
 *   enunciado   obrigatório, até 500 caracteres
 *   opções      escolha única/múltipla: 2 a 30, até 100 caracteres cada, sem repetir
 *   unidade     número/escala, opcional, até 20 caracteres
 *   min / max   número: opcionais, até 2 casas decimais · escala: obrigatórios, inteiros
 *               de -1000 a 1000 · nos dois, min menor que max
 *   gráfico     só número e escala podem aparecer no gráfico de evolução
 */
export interface PerguntaForm {
  /** Só para o React acompanhar a pergunta quando a ordem muda (não vai para a API). */
  chave: string;
  tipo: TipoPergunta;
  enunciado: string;
  obrigatoria: boolean;
  exibirEvolucao: boolean;
  /** Uma opção por linha. */
  opcoes: string;
  unidade: string;
  min: string;
  max: string;
}

export interface ModeloForm {
  tipo: TipoModelo | '';
  nome: string;
  /** '' = serve para qualquer sexo (null na API). */
  sexoAlvo: 'masculino' | 'feminino' | '';
  perguntas: PerguntaForm[];
}

/**
 * Erros pelo caminho do campo, no mesmo formato da API sem o "body."
 * (ex.: "nome", "perguntas", "perguntas.2.enunciado").
 */
export type ErrosModelo = Record<string, string>;

export const MAX_PERGUNTAS = 100;
const MAX_OPCOES = 30;
const LIMITE_NUMERICO = 99_999_999.99;
const LIMITE_ESCALA = 1000;

export const temOpcoes = (tipo: TipoPergunta): boolean =>
  tipo === 'escolha_unica' || tipo === 'multipla_escolha';

export const ehNumerica = (tipo: TipoPergunta): boolean => tipo === 'numero' || tipo === 'escala';

/** id do elemento na tela para o caminho do erro: "perguntas.2.enunciado" → "perguntas-2-enunciado". */
export const idDoCampo = (caminho: string): string => caminho.replaceAll('.', '-');

let proximaChave = 1;
const novaChave = (): string => {
  proximaChave += 1;
  return `p${String(proximaChave)}`;
};

export function novaPergunta(): PerguntaForm {
  return {
    chave: novaChave(),
    tipo: 'texto_curto',
    enunciado: '',
    obrigatoria: false,
    exibirEvolucao: false,
    opcoes: '',
    unidade: '',
    min: '',
    max: '',
  };
}

const textoDoNumero = (valor: number | null): string => (valor === null ? '' : String(valor));

export function formDoModelo(modelo: Modelo): ModeloForm {
  return {
    tipo: modelo.tipo,
    nome: modelo.nome,
    sexoAlvo: modelo.sexoAlvo ?? '',
    perguntas: modelo.perguntas.map((pergunta) => ({
      chave: novaChave(),
      tipo: pergunta.tipo,
      enunciado: pergunta.enunciado,
      obrigatoria: pergunta.obrigatoria,
      exibirEvolucao: pergunta.exibirEvolucao,
      opcoes: (pergunta.opcoes ?? []).join('\n'),
      unidade: pergunta.unidade ?? '',
      min: textoDoNumero(pergunta.min),
      max: textoDoNumero(pergunta.max),
    })),
  };
}

const listaDeOpcoes = (texto: string): string[] =>
  texto
    .split('\n')
    .map((opcao) => opcao.trim())
    .filter(Boolean);

/** "1,5" ou "1.5" → 1.5; vazio → undefined; inválido → NaN. */
function lerNumero(texto: string): number | undefined {
  const limpo = texto.trim().replace(',', '.');
  return limpo ? Number(limpo) : undefined;
}

const duasCasasNoMaximo = (valor: number): boolean =>
  Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

function validarOpcoes(texto: string): string | undefined {
  const opcoes = listaDeOpcoes(texto);
  if (opcoes.length < 2) return 'Informe pelo menos 2 opções (uma por linha).';
  if (opcoes.length > MAX_OPCOES) return `Informe no máximo ${String(MAX_OPCOES)} opções.`;
  if (opcoes.some((opcao) => opcao.length > 100)) {
    return 'Cada opção deve ter no máximo 100 caracteres.';
  }
  if (new Set(opcoes.map((opcao) => opcao.toLowerCase())).size !== opcoes.length) {
    return 'As opções não podem se repetir.';
  }
  return undefined;
}

function validarLimite(pergunta: PerguntaForm, valor: number | undefined): string | undefined {
  if (pergunta.tipo === 'escala') {
    if (valor === undefined || Number.isNaN(valor)) {
      return 'A escala precisa de mínimo e máximo (ex.: 0 a 10).';
    }
    if (!Number.isInteger(valor)) return 'Use números inteiros na escala (ex.: 0 a 10).';
    if (Math.abs(valor) > LIMITE_ESCALA) return 'Use valores entre -1000 e 1000.';
    return undefined;
  }
  if (valor === undefined) return undefined;
  if (Number.isNaN(valor)) return 'Informe um número.';
  if (Math.abs(valor) > LIMITE_NUMERICO) return 'Use valores entre -99.999.999,99 e 99.999.999,99.';
  if (!duasCasasNoMaximo(valor)) return 'Use no máximo 2 casas decimais.';
  return undefined;
}

function validarPergunta(pergunta: PerguntaForm, indice: number, erros: ErrosModelo): void {
  const campo = (nome: string): string => `perguntas.${String(indice)}.${nome}`;
  const enunciado = pergunta.enunciado.trim();

  if (!enunciado) erros[campo('enunciado')] = 'O enunciado da pergunta é obrigatório.';
  else if (enunciado.length > 500) {
    erros[campo('enunciado')] = 'O enunciado deve ter no máximo 500 caracteres.';
  }

  if (temOpcoes(pergunta.tipo)) {
    const erro = validarOpcoes(pergunta.opcoes);
    if (erro) erros[campo('opcoes')] = erro;
  }

  if (ehNumerica(pergunta.tipo)) {
    if (pergunta.unidade.trim().length > 20) {
      erros[campo('unidade')] = 'A unidade deve ter no máximo 20 caracteres.';
    }
    const min = lerNumero(pergunta.min);
    const max = lerNumero(pergunta.max);
    const erroMin = validarLimite(pergunta, min);
    const erroMax = validarLimite(pergunta, max);
    if (erroMin) erros[campo('min')] = erroMin;
    if (erroMax) erros[campo('max')] = erroMax;
    if (!erroMin && !erroMax && min !== undefined && max !== undefined && min >= max) {
      erros[campo('max')] = 'O máximo deve ser maior que o mínimo.';
    }
  }
}

/** Valida tudo de uma vez; objeto vazio = pode enviar. */
export function validarModelo(form: ModeloForm): ErrosModelo {
  const erros: ErrosModelo = {};
  const nome = form.nome.trim();

  if (!form.tipo) erros['tipo'] = 'O tipo do modelo é obrigatório.';
  if (!nome) erros['nome'] = 'O nome do modelo é obrigatório.';
  else if (nome.length < 2) erros['nome'] = 'O nome do modelo deve ter pelo menos 2 caracteres.';
  else if (nome.length > 120) erros['nome'] = 'O nome do modelo deve ter no máximo 120 caracteres.';

  if (form.perguntas.length === 0) erros['perguntas'] = 'Adicione pelo menos uma pergunta.';
  if (form.perguntas.length > MAX_PERGUNTAS) {
    erros['perguntas'] = `O modelo pode ter no máximo ${String(MAX_PERGUNTAS)} perguntas.`;
  }
  form.perguntas.forEach((pergunta, indice) => validarPergunta(pergunta, indice, erros));

  return erros;
}

/**
 * Pergunta no formato da API. Cada tipo aceita só os seus campos
 * (o back recusa campo a mais), por isso o corpo é montado por tipo.
 */
export function perguntaParaApi(pergunta: PerguntaForm): PerguntaEntrada {
  const base = { enunciado: pergunta.enunciado.trim(), obrigatoria: pergunta.obrigatoria };
  const unidade = pergunta.unidade.trim();
  const min = lerNumero(pergunta.min);
  const max = lerNumero(pergunta.max);
  const extrasNumericos = {
    ...(unidade && { unidade }),
    exibirEvolucao: pergunta.exibirEvolucao,
  };

  switch (pergunta.tipo) {
    case 'escolha_unica':
    case 'multipla_escolha':
      return {
        tipo: pergunta.tipo,
        ...base,
        opcoes: listaDeOpcoes(pergunta.opcoes),
        exibirEvolucao: false,
      };
    case 'numero':
      return {
        tipo: 'numero',
        ...base,
        ...extrasNumericos,
        ...(min !== undefined && { min }),
        ...(max !== undefined && { max }),
      };
    case 'escala':
      return { tipo: 'escala', ...base, ...extrasNumericos, min: min ?? 0, max: max ?? 0 };
    default:
      return { tipo: pergunta.tipo, ...base, exibirEvolucao: false };
  }
}

/** Caminhos de erro da API que têm um lugar na tela; o resto vai para o aviso. */
const CAMPO_DO_MODELO = /^(tipo|nome|sexoAlvo|perguntas)$/;
const CAMPO_DA_PERGUNTA =
  /^perguntas\.\d+\.(enunciado|opcoes|unidade|min|max|exibirEvolucao)(?=\.|$)/;

/**
 * Separa os erros de validação da API ("body.perguntas.2.enunciado") em erros por campo
 * e o que não é de nenhum campo (vai para o aviso).
 */
export function errosDaApi(details: readonly ApiErrorDetail[]): {
  porCampo: ErrosModelo;
  outros: string[];
} {
  const porCampo: ErrosModelo = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const caminho = field.replace(/^body\./, '');
    // "perguntas.2.opcoes.1" (uma opção) → erro no campo de opções da pergunta 2.
    const campo = CAMPO_DA_PERGUNTA.exec(caminho)?.[0] ?? caminho;
    if (CAMPO_DO_MODELO.test(campo) || CAMPO_DA_PERGUNTA.test(campo)) {
      porCampo[campo] ??= message;
    } else {
      outros.push(message);
    }
  });

  return { porCampo, outros };
}

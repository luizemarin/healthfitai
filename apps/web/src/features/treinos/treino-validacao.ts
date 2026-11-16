import type { ExercicioResumo, ItemTreinoEntrada, Treino } from './treinos-api';
import type { ApiErrorDetail } from '../../api/api-error';

/**
 * Formulário do treino e validação — mesmas regras do back
 * (apps/api/src/modules/treinos/treinos.schemas.ts). Roda ao salvar; o back valida de novo
 * e, se recusar, a mensagem dele volta para o campo certo (errosDaApi).
 * Mudou uma regra no back? Ajuste aqui também.
 *
 *   nome              obrigatório, até 120 caracteres
 *   exercicios        de 1 a 30; o mesmo exercício uma vez só; nenhum excluído da biblioteca
 *   series            inteiro de 1 a 20
 *   repeticoes        texto obrigatório, até 20 caracteres (ex.: "12", "8-12", "até a falha")
 *   descansoSegundos  inteiro de 0 a 1800 (0 = sem descanso)
 *   cargaKg           opcional; de 0 a 1000, no máximo 2 casas decimais (vazio = sem carga)
 */
export const LIMITES = {
  nome: 120,
  exercicios: 30,
  series: 20,
  repeticoes: 20,
  descanso: 1800,
  carga: 1000,
} as const;

/** Um exercício do treino. Os números ficam como texto enquanto a pessoa digita. */
export interface ItemForm {
  /** Chave estável para o React (o exercício aparece uma vez só por treino). */
  chave: string;
  exercicio: ExercicioResumo;
  series: string;
  repeticoes: string;
  descanso: string;
  carga: string;
}

export type CampoItem = 'exercicioId' | 'series' | 'repeticoes' | 'descansoSegundos' | 'cargaKg';

export interface TreinoForm {
  nome: string;
  itens: ItemForm[];
}

/** Erros por caminho, no mesmo formato do back sem o "body.": "nome", "exercicios.2.series". */
export type ErrosTreino = Record<string, string | undefined>;

/** id do campo na tela a partir do caminho do erro ("exercicios.2.series" → "exercicios-2-series"). */
export const idDoCampo = (caminho: string): string => caminho.replaceAll('.', '-');

export const caminhoItem = (indice: number, campo: CampoItem): string =>
  `exercicios.${String(indice)}.${campo}`;

export const FORM_VAZIO: TreinoForm = { nome: '', itens: [] };

/** Exercício recém-adicionado: os números ficam em branco para o profissional preencher. */
export function novoItem(exercicio: ExercicioResumo): ItemForm {
  return { chave: exercicio.id, exercicio, series: '', repeticoes: '', descanso: '', carga: '' };
}

export function formDoTreino(treino: Treino): TreinoForm {
  return {
    nome: treino.nome,
    itens: treino.exercicios.map((item) => ({
      chave: item.exercicio.id,
      exercicio: item.exercicio,
      series: String(item.series),
      repeticoes: item.repeticoes,
      descanso: String(item.descansoSegundos),
      carga: item.cargaKg === null ? '' : String(item.cargaKg).replace('.', ','),
    })),
  };
}

/** Aceita vírgula ou ponto como separador decimal ("42,5" ou "42.5"). */
const paraNumero = (valor: string): number => Number(valor.trim().replace(',', '.'));

const ehInteiro = (valor: string): boolean => /^\d+$/.test(valor.trim());

function validarSeries(valor: string): string | undefined {
  if (!valor.trim()) return 'Informe as séries.';
  const series = paraNumero(valor);
  if (!ehInteiro(valor) || series < 1 || series > LIMITES.series) {
    return `As séries devem ser um número inteiro de 1 a ${String(LIMITES.series)}.`;
  }
  return undefined;
}

function validarRepeticoes(valor: string): string | undefined {
  if (!valor.trim()) return 'Informe as repetições (ex.: "12", "8-12" ou "até a falha").';
  if (valor.trim().length > LIMITES.repeticoes) {
    return `As repetições devem ter no máximo ${String(LIMITES.repeticoes)} caracteres.`;
  }
  return undefined;
}

function validarDescanso(valor: string): string | undefined {
  if (!valor.trim()) return 'Informe o descanso em segundos (0 = sem descanso).';
  if (!ehInteiro(valor) || paraNumero(valor) > LIMITES.descanso) {
    return `O descanso deve ser um número inteiro de 0 a ${String(LIMITES.descanso)} segundos.`;
  }
  return undefined;
}

function validarCarga(valor: string): string | undefined {
  const texto = valor.trim();
  if (!texto) return undefined;
  if (texto.startsWith('-')) return 'A carga não pode ser negativa.';
  if (!/^\d+([.,]\d+)?$/.test(texto)) return 'A carga deve ser um número em quilos (ex.: 42,5).';
  if (paraNumero(texto) > LIMITES.carga) {
    return `A carga deve ser de no máximo ${String(LIMITES.carga)} kg.`;
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(texto)) {
    return 'A carga aceita no máximo 2 casas decimais (ex.: 42,5).';
  }
  return undefined;
}

function validarNome(valor: string): string | undefined {
  const nome = valor.trim();
  if (!nome) return 'O nome do treino é obrigatório.';
  if (nome.length > LIMITES.nome) {
    return `O nome do treino deve ter no máximo ${String(LIMITES.nome)} caracteres.`;
  }
  return undefined;
}

/** Valida tudo de uma vez; objeto vazio = pode enviar. */
export function validarTreino(form: TreinoForm): ErrosTreino {
  const erros: ErrosTreino = { nome: validarNome(form.nome) };

  if (form.itens.length === 0) {
    erros['exercicios'] = 'O treino precisa de pelo menos um exercício.';
  } else if (form.itens.length > LIMITES.exercicios) {
    erros['exercicios'] = `O treino pode ter no máximo ${String(LIMITES.exercicios)} exercícios.`;
  }

  form.itens.forEach((item, indice) => {
    if (!item.exercicio.ativo) {
      erros[caminhoItem(indice, 'exercicioId')] =
        `O exercício "${item.exercicio.nome}" foi excluído da biblioteca. Remova-o e adicione outro.`;
    }
    erros[caminhoItem(indice, 'series')] = validarSeries(item.series);
    erros[caminhoItem(indice, 'repeticoes')] = validarRepeticoes(item.repeticoes);
    erros[caminhoItem(indice, 'descansoSegundos')] = validarDescanso(item.descanso);
    erros[caminhoItem(indice, 'cargaKg')] = validarCarga(item.carga);
  });

  // Remove os campos sem erro.
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro));
}

/** Converte o formulário (já validado) no corpo que a API espera. Carga vazia = sem carga (null). */
export function paraEnvio(form: TreinoForm): { nome: string; exercicios: ItemTreinoEntrada[] } {
  return {
    nome: form.nome.trim(),
    exercicios: form.itens.map((item) => ({
      exercicioId: item.exercicio.id,
      series: paraNumero(item.series),
      repeticoes: item.repeticoes.trim(),
      descansoSegundos: paraNumero(item.descanso),
      cargaKg: item.carga.trim() ? paraNumero(item.carga) : null,
    })),
  };
}

const CAMPO_DO_TREINO = /^(nome|exercicios)$/;
const CAMPO_DO_ITEM = /^exercicios\.\d+\.(exercicioId|series|repeticoes|descansoSegundos|cargaKg)$/;

/**
 * Separa os erros da API ("body.exercicios.2.series") em erros por campo do formulário
 * e o que não é de nenhum campo (vai para o aviso).
 * Exercício que não existe na biblioteca: o back manda o id técnico, então a tela usa um texto amigável.
 */
export function errosDaApi(
  details: readonly ApiErrorDetail[],
  code: string,
): { porCampo: ErrosTreino; outros: string[] } {
  const porCampo: ErrosTreino = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const caminho = field.replace(/^body\./, '');
    if (CAMPO_DO_TREINO.test(caminho) || CAMPO_DO_ITEM.test(caminho)) {
      const amigavel =
        code === 'EXERCICIO_NAO_ENCONTRADO'
          ? 'Este exercício não está mais na sua biblioteca. Remova-o e adicione outro.'
          : message;
      porCampo[caminho] ??= amigavel;
    } else {
      outros.push(message);
    }
  });

  return { porCampo, outros };
}

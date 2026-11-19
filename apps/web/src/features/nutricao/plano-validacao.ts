import type { PlanoNutricional, RefeicaoPlanoEntrada } from './nutricao-api';
import type { ApiErrorDetail } from '../../api/api-error';

/**
 * Formulário do plano nutricional e validação — mesmas regras do back
 * (apps/api/src/modules/nutricao/nutricao.schemas.ts). Roda ao salvar; o back valida de novo
 * e, se recusar, a mensagem dele volta para o campo certo (errosDaApi).
 * Mudou uma regra no back? Ajuste aqui também.
 *
 *   nome         obrigatório, até 120 caracteres
 *   observacoes  opcional, até 2000 caracteres (vazio = sem observação)
 *   refeicoes    de 1 a 15, na ordem do dia
 *   refeicao     obrigatório, até 60 caracteres (ex.: "Café da manhã")
 *   horario      opcional, HH:MM de 00:00 a 23:59 (vazio = sem horário)
 *   descricao    obrigatória, até 2000 caracteres (alimentos e quantidades)
 */
export const LIMITES = {
  nome: 120,
  observacoes: 2000,
  refeicoes: 15,
  refeicao: 60,
  descricao: 2000,
} as const;

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Uma refeição do plano, como está na tela. */
export interface RefeicaoForm {
  /** Chave estável para o React (as refeições não têm id até serem salvas). */
  chave: string;
  refeicao: string;
  horario: string;
  descricao: string;
}

export type CampoRefeicao = 'refeicao' | 'horario' | 'descricao';

export interface PlanoForm {
  nome: string;
  observacoes: string;
  refeicoes: RefeicaoForm[];
}

/** Erros por caminho, no mesmo formato do back sem o "body.": "nome", "refeicoes.2.descricao". */
export type ErrosPlano = Record<string, string | undefined>;

/** id do campo na tela a partir do caminho do erro ("refeicoes.2.descricao" → "refeicoes-2-descricao"). */
export const idDoCampo = (caminho: string): string => caminho.replaceAll('.', '-');

export const caminhoRefeicao = (indice: number, campo: CampoRefeicao): string =>
  `refeicoes.${String(indice)}.${campo}`;

let contador = 0;
const novaChave = (): string => {
  contador += 1;
  return `refeicao-${String(contador)}`;
};

export function novaRefeicao(): RefeicaoForm {
  return { chave: novaChave(), refeicao: '', horario: '', descricao: '' };
}

/** Plano novo já começa com uma refeição em branco (o plano precisa de pelo menos uma). */
export function formVazio(): PlanoForm {
  return { nome: '', observacoes: '', refeicoes: [novaRefeicao()] };
}

export function formDoPlano(plano: PlanoNutricional): PlanoForm {
  return {
    nome: plano.nome,
    observacoes: plano.observacoes ?? '',
    refeicoes: plano.refeicoes.map((item) => ({
      chave: novaChave(),
      refeicao: item.refeicao,
      horario: item.horario ?? '',
      descricao: item.descricao,
    })),
  };
}

/** Texto obrigatório: vazio → `vazio`; longo demais → "<nomeCampo> deve ter no máximo N caracteres." */
function obrigatorio(
  valor: string,
  max: number,
  vazio: string,
  nomeCampo: string,
): string | undefined {
  const texto = valor.trim();
  if (!texto) return vazio;
  if (texto.length > max) return `${nomeCampo} deve ter no máximo ${String(max)} caracteres.`;
  return undefined;
}

/** Valida tudo de uma vez; objeto vazio = pode enviar. */
export function validarPlano(form: PlanoForm): ErrosPlano {
  const erros: ErrosPlano = {
    nome: obrigatorio(form.nome, LIMITES.nome, 'Informe o nome do plano.', 'O nome do plano'),
    observacoes:
      form.observacoes.trim().length > LIMITES.observacoes
        ? `As observações devem ter no máximo ${String(LIMITES.observacoes)} caracteres.`
        : undefined,
  };

  if (form.refeicoes.length === 0) {
    erros['refeicoes'] = 'O plano precisa de pelo menos uma refeição.';
  } else if (form.refeicoes.length > LIMITES.refeicoes) {
    erros['refeicoes'] = `O plano pode ter no máximo ${String(LIMITES.refeicoes)} refeições.`;
  }

  form.refeicoes.forEach((item, indice) => {
    erros[caminhoRefeicao(indice, 'refeicao')] = obrigatorio(
      item.refeicao,
      LIMITES.refeicao,
      'Informe o nome da refeição (ex.: "Café da manhã").',
      'O nome da refeição',
    );
    erros[caminhoRefeicao(indice, 'horario')] =
      item.horario.trim() && !HORARIO.test(item.horario.trim())
        ? 'O horário deve estar no formato HH:MM, de 00:00 a 23:59 (ex.: 07:30).'
        : undefined;
    erros[caminhoRefeicao(indice, 'descricao')] = obrigatorio(
      item.descricao,
      LIMITES.descricao,
      'Informe os alimentos e as quantidades da refeição.',
      'A descrição da refeição',
    );
  });

  // Remove os campos sem erro.
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro));
}

/**
 * Converte o formulário (já validado) no corpo que a API espera.
 * Horário vazio = sem horário (null); observação vazia = sem observação (null).
 */
export function paraEnvio(form: PlanoForm): {
  nome: string;
  observacoes: string | null;
  refeicoes: RefeicaoPlanoEntrada[];
} {
  return {
    nome: form.nome.trim(),
    observacoes: form.observacoes.trim() || null,
    refeicoes: form.refeicoes.map((item) => ({
      refeicao: item.refeicao.trim(),
      horario: item.horario.trim() || null,
      descricao: item.descricao.trim(),
    })),
  };
}

const CAMPO_DO_PLANO = /^(nome|observacoes|refeicoes)$/;
const CAMPO_DA_REFEICAO = /^refeicoes\.\d+\.(refeicao|horario|descricao)$/;

/**
 * Separa os erros da API ("body.refeicoes.2.descricao") em erros por campo do formulário
 * e o que não é de nenhum campo (vai para o aviso).
 */
export function errosDaApi(details: readonly ApiErrorDetail[]): {
  porCampo: ErrosPlano;
  outros: string[];
} {
  const porCampo: ErrosPlano = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const caminho = field.replace(/^body\./, '');
    if (CAMPO_DO_PLANO.test(caminho) || CAMPO_DA_REFEICAO.test(caminho)) {
      porCampo[caminho] ??= message;
    } else {
      outros.push(message);
    }
  });

  return { porCampo, outros };
}

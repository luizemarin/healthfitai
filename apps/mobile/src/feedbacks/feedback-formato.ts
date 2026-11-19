import type { StatusFeedback } from './feedbacks-api';

/**
 * Textos dos feedbacks para o aluno (pt-BR).
 *
 * O back chama de "enviado" o feedback que saiu e espera resposta; para o aluno ele é "Pendente"
 * (MB-FBK-01: pendentes, respondidos e atrasados). "agendado" ainda não saiu e não aparece na lista.
 */
export const STATUS_LABEL: Record<StatusFeedback, string> = {
  agendado: 'Agendado',
  enviado: 'Pendente',
  atrasado: 'Atrasado',
  respondido: 'Respondido',
};

/** Seções da lista, na ordem da tela: o que falta responder primeiro. */
export const SECOES: readonly { status: StatusFeedback; titulo: string; vazio: string }[] = [
  { status: 'enviado', titulo: 'Pendentes', vazio: 'Nenhum feedback pendente.' },
  { status: 'atrasado', titulo: 'Atrasados', vazio: 'Nenhum feedback atrasado.' },
  { status: 'respondido', titulo: 'Respondidos', vazio: 'Nenhum feedback respondido ainda.' },
];

/** Mensagens do back escritas para o profissional ("ative o modelo…") trocadas por frases para o aluno. */
export const PARA_O_ALUNO = {
  MODELO_INATIVO: 'Este feedback está indisponível no momento. Fale com seu treinador.',
} as const;

/** "1 comentário do treinador" / "2 comentários do treinador". */
export function textoComentarios(total: number): string {
  return total === 1 ? '1 comentário do treinador' : `${String(total)} comentários do treinador`;
}

/** Ids da API são UUID: um link de feedback com outra coisa nem vai à API. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idValido(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

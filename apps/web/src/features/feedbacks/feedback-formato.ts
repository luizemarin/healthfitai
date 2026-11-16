import type { Recorrencia, StatusFeedback } from './feedbacks-api';

/** Textos e regras de exibição dos feedbacks (pt-BR). Regras iguais às do back. */

export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  avulso: 'Avulso (uma vez só)',
};

export const RECORRENCIAS = Object.keys(RECORRENCIA_LABEL) as Recorrencia[];

/** Mesma ordem da máquina de status do back (BE-FBK-04). */
export const STATUS_LABEL: Record<StatusFeedback, string> = {
  agendado: 'Agendado',
  enviado: 'Enviado',
  respondido: 'Respondido',
  atrasado: 'Atrasado',
};

export const STATUS_FEEDBACK = Object.keys(STATUS_LABEL) as StatusFeedback[];

/** Mesmo limite do comentário no back (BE-FBK-05). */
export const MAX_TEXTO_COMENTARIO = 2000;

/** Maior dia aceito na recorrência mensal (nem todo mês tem 29, 30 ou 31). */
export const ULTIMO_DIA_MENSAL = 28;

/**
 * Maior lembrete permitido: precisa sair antes do próximo feedback (BE-FBK-03).
 * semanal 6 · quinzenal 13 · mensal 27 · avulso 30.
 */
export const MAX_LEMBRETE_DIAS: Record<Recorrencia, number> = {
  semanal: 6,
  quinzenal: 13,
  mensal: 27,
  avulso: 30,
};

/** Dia do mês no horário de Brasília (o back conta a recorrência mensal nesse fuso). */
export function diaDoMesEmBrasilia(data: Date): number {
  return Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric' }).format(
      data,
    ),
  );
}

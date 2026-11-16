import type { StatusFeedback } from './feedbacks.repository';

/**
 * BE-FBK-04 · Máquina de status do feedback (testes: QA-UNI-02).
 *
 *   agendado ──► enviado ──► respondido
 *                   │            ▲
 *                   └─► atrasado ┘
 *
 *   agendado   → criado pelo job; o e-mail ainda não saiu
 *   enviado    → e-mail com o link saiu
 *   atrasado   → passou o prazo do lembrete sem resposta; o lembrete saiu (BE-FBK-03)
 *   respondido → o aluno enviou as respostas (final; não muda mais)
 *
 * Responder atrasado é permitido (atrasado → respondido). Qualquer outra
 * mudança é recusada, inclusive voltar atrás.
 */
const TRANSICOES: Record<StatusFeedback, readonly StatusFeedback[]> = {
  agendado: ['enviado'],
  enviado: ['respondido', 'atrasado'],
  atrasado: ['respondido'],
  respondido: [],
};

export function podeMudarStatus(de: StatusFeedback, para: StatusFeedback): boolean {
  return TRANSICOES[de].includes(para);
}

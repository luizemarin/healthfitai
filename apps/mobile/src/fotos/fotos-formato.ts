import { ApiError } from '../api/api-error';

/**
 * Textos das fotos para o aluno (pt-BR).
 *
 * Mensagens do back escritas para o profissional ("Ative a pose…", "Peça um novo envio…") trocadas
 * por frases para o aluno. As demais vão como vêm (ex.: "A foto deve ter no máximo 10 MB.").
 */
export const PARA_O_ALUNO = {
  POSE_INATIVA:
    'Esta pose não é mais pedida pelo seu treinador. Volte e abra a tela de novo para ver as poses atuais.',
  ENVIO_NAO_ENCONTRADO: 'A foto não chegou ao servidor. Toque em "Tentar de novo".',
  SEM_FOTOS_NA_DATA: 'Você não tem fotos numa das datas escolhidas. Escolha outra data.',
} as const;

export const FALHA_PADRAO = 'Pode ter sido uma falha momentânea. Tente de novo em instantes.';

/** Falha passageira (sem conexão, servidor ou storage fora): o próprio app tenta de novo sozinho. */
export function falhaPassageira(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

/**
 * Vale oferecer "Tentar de novo" com a mesma foto: falha passageira ou envio que não chegou ao
 * storage (a nova tentativa pede outro envio). Foto recusada (grande demais, inválida) não: o aluno
 * precisa tirar ou escolher outra.
 */
export function podeTentarDeNovo(error: unknown): boolean {
  return (
    falhaPassageira(error) ||
    (error instanceof ApiError &&
      (error.code === 'ENVIO_NAO_ENCONTRADO' || error.code === 'UPLOAD_RECUSADO'))
  );
}

/** "Pose 1 de 3" */
export function posicaoDaPose(indice: number, total: number): string {
  return `Pose ${String(indice + 1)} de ${String(total)}`;
}

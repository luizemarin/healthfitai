import { ApiError } from '../api/api-error';

import type { ApiErrorDetail } from '../api/api-error';

/** Erros do formulário por id da pergunta. */
export type ErrosPorPergunta = Record<string, string | undefined>;

/** Frase para o aluno no lugar da mensagem do back, por código de erro. */
export type MensagensParaOAluno = Readonly<Record<string, string>>;

export const SEM_CONEXAO = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';

/**
 * Mensagens do back escritas para o profissional ("reative o aluno") trocadas por uma frase para o
 * aluno. Valem para todas as telas; cada tela pode somar as suas (ex.: MODELO_INATIVO).
 */
const PARA_O_ALUNO: MensagensParaOAluno = {
  ALUNO_INATIVO: 'Seu cadastro está inativo no momento. Fale com seu treinador.',
};

/**
 * Frase para o aluno: a mensagem do back quando ela foi escrita para o usuário; senão, a frase
 * amigável padrão. Sem conexão e falha do servidor nunca mostram texto técnico.
 */
export function mensagemDoErro(
  error: unknown,
  padrao: string,
  paraOAluno: MensagensParaOAluno = {},
): string {
  if (!(error instanceof ApiError)) {
    return padrao;
  }
  if (error.status === 0) {
    return SEM_CONEXAO;
  }

  const trocada = paraOAluno[error.code] ?? PARA_O_ALUNO[error.code];
  if (trocada) {
    return trocada;
  }

  const escritaParaUsuario =
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401 &&
    error.code !== 'ROUTE_NOT_FOUND' &&
    error.code !== 'UNEXPECTED_ERROR';
  return escritaParaUsuario ? error.message : padrao;
}

/**
 * Erros da API → pergunta certa. O back aponta:
 *   perguntas.<id>              obrigatória sem resposta (ao enviar)
 *   body.respostas.<i>.valor    valor inválido (i = posição na lista enviada)
 */
export function errosPorPergunta(
  details: readonly ApiErrorDetail[],
  idsEnviados: readonly string[],
): ErrosPorPergunta {
  const erros: ErrosPorPergunta = {};

  details.forEach(({ field, message }) => {
    const obrigatoria = /^perguntas\.(.+)$/.exec(field)?.[1];
    const indice = /^body\.respostas\.(\d+)/.exec(field)?.[1];
    const perguntaId =
      obrigatoria ?? (indice === undefined ? undefined : idsEnviados[Number(indice)]);

    if (perguntaId) {
      erros[perguntaId] ??= message;
    }
  });
  return erros;
}

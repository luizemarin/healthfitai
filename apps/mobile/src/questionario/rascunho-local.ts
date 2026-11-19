import { File, Paths } from 'expo-file-system';

import type { ValorCampo } from './valores';

/**
 * Cópia do rascunho no aparelho (MB-ANA-02, também usada no feedback): o que o aluno digitou não
 * se perde se a internet cair ou o app fechar antes de o autosave chegar ao servidor.
 *
 * Guarda só as respostas que o servidor ainda não confirmou (o resto já está lá), num arquivo
 * JSON na pasta de documentos do app: área privada do app, com a mesma API no iOS e no Android.
 * Sem pendências, o arquivo é apagado. `chave` é o nome do arquivo (ex.: "anamnese-rascunho-<id>").
 *
 * Nunca derruba a tela: se o armazenamento falhar, só avisa no console e o autosave no servidor
 * continua normalmente.
 */
export interface RascunhoLocal {
  submissaoId: string;
  /** Valores das perguntas pendentes, como estão na tela. */
  valores: Record<string, ValorCampo>;
  /** Perguntas alteradas que o servidor ainda não confirmou. */
  pendentes: string[];
}

function arquivo(chave: string): File {
  return new File(Paths.document, `${chave}.json`);
}

function isRascunhoLocal(value: unknown): value is RascunhoLocal {
  const rascunho = value as Partial<RascunhoLocal> | null;
  return (
    typeof rascunho?.submissaoId === 'string' &&
    typeof rascunho.valores === 'object' &&
    rascunho.valores !== null &&
    Array.isArray(rascunho.pendentes) &&
    rascunho.pendentes.every((id) => typeof id === 'string')
  );
}

export const rascunhoLocal = {
  /** Rascunho guardado no aparelho, ou null (não existe ou está corrompido). */
  ler: (chave: string): RascunhoLocal | null => {
    try {
      const file = arquivo(chave);
      if (!file.exists) {
        return null;
      }
      const parsed: unknown = JSON.parse(file.textSync());
      return isRascunhoLocal(parsed) ? parsed : null;
    } catch (error) {
      console.warn('[questionário] Não foi possível ler o rascunho guardado no aparelho.', error);
      return null;
    }
  },

  gravar: (chave: string, rascunho: RascunhoLocal): void => {
    try {
      const file = arquivo(chave);
      if (!file.exists) {
        file.create();
      }
      file.writeSync(JSON.stringify(rascunho));
    } catch (error) {
      console.warn('[questionário] Não foi possível guardar o rascunho no aparelho.', error);
    }
  },

  apagar: (chave: string): void => {
    try {
      const file = arquivo(chave);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      console.warn('[questionário] Não foi possível apagar o rascunho do aparelho.', error);
    }
  },
};

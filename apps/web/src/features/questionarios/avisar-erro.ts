import { mensagemDaApi } from './questionario-formato';
import { ApiError } from '../../api/api-error';

import type { useToast } from '../../components/feedback/toast';

/**
 * Aviso de erro de uma ação (salvar, duplicar, desativar…): usa a mensagem do back quando ela
 * foi escrita para o usuário; senão, o texto amigável padrão (sem conexão, servidor fora…).
 */
export function avisarErro(
  toast: ReturnType<typeof useToast>,
  error: unknown,
  titulo: string,
): void {
  const mensagem = mensagemDaApi(error);
  if (mensagem && error instanceof ApiError) {
    toast.error(
      titulo,
      mensagem,
      error.details.map((detalhe) => detalhe.message),
    );
    return;
  }
  toast.fromError(error, titulo);
}

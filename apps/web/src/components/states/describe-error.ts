import { ApiError } from '../../api/api-error';

/** O que mostrar ao usuário para um erro: texto amigável, sem detalhe técnico. */
export interface FriendlyError {
  title: string;
  message: string;
  /** Faz sentido oferecer "Tentar novamente"? (ex.: sem conexão sim; acesso negado não). */
  canRetry: boolean;
}

/** Arquivo de uma tela não baixou (ex.: o painel foi atualizado enquanto estava aberto). */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|module script failed|Loading chunk/i.test(error.message)
  );
}

/**
 * Traduz qualquer erro (da API, do navegador ou inesperado) em uma mensagem amigável.
 * Ponto único: todas as telas mostram o mesmo texto para o mesmo problema.
 */
export function describeError(error: unknown): FriendlyError {
  if (isChunkLoadError(error)) {
    return {
      title: 'O painel foi atualizado',
      message: 'Recarregue a página para usar a versão mais recente.',
      canRetry: true,
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 0) {
      return {
        title: 'Sem conexão',
        message: 'Verifique sua internet e tente de novo.',
        canRetry: true,
      };
    }
    if (error.status === 401) {
      return {
        title: 'Sua sessão expirou',
        message: 'Entre novamente para continuar.',
        canRetry: false,
      };
    }
    if (error.status === 403) {
      return {
        title: 'Acesso não permitido',
        message: 'Você não tem permissão para ver este conteúdo.',
        canRetry: false,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Não encontramos o que você procurava',
        message: 'Pode ter sido removido ou o endereço mudou.',
        canRetry: false,
      };
    }
    if (error.status >= 500) {
      return {
        title: 'O servidor está instável',
        message: 'O problema é do nosso lado. Tente de novo em instantes.',
        canRetry: true,
      };
    }
    // Demais 4xx: a API já devolve uma mensagem pensada para o usuário.
    return { title: 'Não foi possível concluir', message: error.message, canRetry: true };
  }

  return {
    title: 'Algo deu errado',
    message: 'Não conseguimos carregar este conteúdo. Tente de novo em instantes.',
    canRetry: true,
  };
}

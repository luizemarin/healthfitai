import { AppError } from '../errors/app-error';

/**
 * Contrato do storage de arquivos (compatível com S3: Cloudflare R2 em produção).
 * Os módulos só conhecem esta interface; a implementação é escolhida em
 * routes.ts (createObjectStorage).
 *
 * Regra de segurança (BE-FOT-02): o bucket é PRIVADO e nada tem URL pública
 * permanente. Quem precisa enviar ou ver um arquivo recebe uma URL ASSINADA,
 * que vale poucos minutos.
 */

export interface InfoObjeto {
  /** Tamanho em bytes. */
  tamanho: number;
  contentType: string | null;
}

export interface OpcoesEnvio {
  /** Content-Type que o cliente vai enviar (entra na assinatura). */
  contentType: string;
  /** Tamanho exato do arquivo em bytes (entra na assinatura: outro tamanho é recusado). */
  tamanho: number;
  expiraEmSegundos: number;
}

export interface ObjectStorage {
  /** URL assinada para o cliente enviar o arquivo direto ao bucket (PUT). */
  urlDeEnvio: (chave: string, opcoes: OpcoesEnvio) => Promise<string>;
  /** URL assinada para ver/baixar o arquivo (GET). */
  urlDeLeitura: (chave: string, expiraEmSegundos: number) => Promise<string>;
  /** Tamanho e tipo do arquivo; null se não existir. */
  info: (chave: string) => Promise<InfoObjeto | null>;
  /** Conteúdo do arquivo; null se não existir. */
  baixar: (chave: string) => Promise<Buffer | null>;
  salvar: (chave: string, conteudo: Buffer, contentType: string) => Promise<void>;
  /** Apaga os arquivos. Chave que não existe é ignorada. */
  apagar: (chaves: readonly string[]) => Promise<void>;
}

/** Erros de infraestrutura do storage (503: o problema não é a requisição do cliente). */
export const StorageErros = {
  naoConfigurado: (): AppError =>
    new AppError(
      503,
      'STORAGE_NAO_CONFIGURADO',
      'O armazenamento de fotos não está configurado nesta API. Avise o suporte.',
    ),
  indisponivel: (): AppError =>
    new AppError(
      503,
      'STORAGE_INDISPONIVEL',
      'Não foi possível acessar o armazenamento de fotos agora. Tente novamente em instantes.',
    ),
};

/**
 * Usada quando as variáveis STORAGE_* não foram definidas: a API sobe
 * normalmente e só as operações com arquivo respondem 503.
 */
async function storageNaoConfigurado(): Promise<never> {
  throw StorageErros.naoConfigurado();
}

export const unconfiguredObjectStorage: ObjectStorage = {
  urlDeEnvio: storageNaoConfigurado,
  urlDeLeitura: storageNaoConfigurado,
  info: storageNaoConfigurado,
  baixar: storageNaoConfigurado,
  salvar: storageNaoConfigurado,
  apagar: storageNaoConfigurado,
};

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { StorageErros, unconfiguredObjectStorage } from './object-storage';

import type { InfoObjeto, ObjectStorage, OpcoesEnvio } from './object-storage';
import type { Env } from '../../config/env';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Headers que o cliente envia no PUT e que fazem parte da assinatura. */
const HEADERS_ASSINADOS = new Set(['content-type', 'content-length']);

function naoExiste(error: unknown): boolean {
  return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
}

/** Executa a operação e troca qualquer erro inesperado por 503 (detalhe só no log). */
async function executar<T>(operacao: string, acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[storage] falha ao ${operacao}: ${detalhe}\n`);
    throw StorageErros.indisponivel();
  }
}

/**
 * Storage em bucket compatível com S3 (Cloudflare R2, AWS S3, MinIO...).
 *
 * Qualquer falha de rede/credencial vira 503 STORAGE_INDISPONIVEL para o
 * cliente; o detalhe técnico vai só para o log (stderr).
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Caminho /bucket/chave: funciona no R2 e em storages locais (MinIO etc.).
      forcePathStyle: true,
      // Sem checksum automático: ele entraria na URL assinada e o R2/app recusariam o envio.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async urlDeEnvio(chave: string, opcoes: OpcoesEnvio): Promise<string> {
    return executar('gerar URL de envio', async () =>
      getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: chave,
          ContentType: opcoes.contentType,
          ContentLength: opcoes.tamanho,
        }),
        { expiresIn: opcoes.expiraEmSegundos, signableHeaders: HEADERS_ASSINADOS },
      ),
    );
  }

  async urlDeLeitura(chave: string, expiraEmSegundos: number): Promise<string> {
    return executar('gerar URL de leitura', async () =>
      getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: chave }), {
        expiresIn: expiraEmSegundos,
      }),
    );
  }

  async info(chave: string): Promise<InfoObjeto | null> {
    return executar('consultar arquivo', async () => {
      try {
        const resposta = await this.client.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: chave }),
        );
        return { tamanho: resposta.ContentLength ?? 0, contentType: resposta.ContentType ?? null };
      } catch (error) {
        if (naoExiste(error)) {
          return null;
        }
        throw error;
      }
    });
  }

  async baixar(chave: string): Promise<Buffer | null> {
    return executar('baixar arquivo', async () => {
      try {
        const resposta = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: chave }),
        );
        const bytes = await resposta.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch (error) {
        if (naoExiste(error)) {
          return null;
        }
        throw error;
      }
    });
  }

  async salvar(chave: string, conteudo: Buffer, contentType: string): Promise<void> {
    await executar('salvar arquivo', async () =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: chave,
          Body: conteudo,
          ContentType: contentType,
        }),
      ),
    );
  }

  async apagar(chaves: readonly string[]): Promise<void> {
    await executar('apagar arquivos', async () =>
      Promise.all(
        chaves.map(async (chave) =>
          this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chave })),
        ),
      ),
    );
  }
}

/** Storage S3 quando as variáveis STORAGE_* existem; senão, o que responde 503. */
export function createObjectStorage(env: Env): ObjectStorage {
  const {
    STORAGE_ENDPOINT: endpoint,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY_ID: accessKeyId,
    STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return unconfiguredObjectStorage;
  }

  return new S3ObjectStorage({
    endpoint,
    region: env.STORAGE_REGION,
    bucket,
    accessKeyId,
    secretAccessKey,
  });
}

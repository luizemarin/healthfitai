import sharp from 'sharp';

/**
 * BE-FOT-03 · Processamento da imagem enviada, antes de ela virar foto do aluno.
 *
 *   1. Confere que o arquivo é mesmo uma imagem JPEG, PNG ou WebP (pelo
 *      conteúdo, não pelo que o cliente declarou).
 *   2. Gira a imagem conforme a orientação da câmera (EXIF) e depois REMOVE
 *      todos os metadados: EXIF, GPS, modelo do aparelho etc. (dado sensível).
 *   3. Comprime em JPEG, limitando o maior lado a 2048 px.
 *   4. Gera a miniatura da galeria (maior lado 400 px).
 *
 * O sharp não copia metadados para a saída, a menos que se peça
 * (keepMetadata/withMetadata). Aqui isso nunca é pedido.
 */

const FORMATOS_ACEITOS: ReadonlySet<string> = new Set(['jpeg', 'png', 'webp']);

/** Proteção contra "bomba de descompressão": ~ 50 megapixels (ex.: 8000 x 6000). */
const MAX_PIXELS = 50_000_000;

const FOTO = { lado: 2048, qualidade: 82 } as const;
const MINIATURA = { lado: 400, qualidade: 75 } as const;

export const CONTENT_TYPE_PROCESSADO = 'image/jpeg';

export type MotivoImagemInvalida = 'formato' | 'dimensoes' | 'corrompida';

/** Lançado quando o arquivo não pode virar foto. O service traduz em 400 para o cliente. */
export class ImagemInvalidaError extends Error {
  public readonly motivo: MotivoImagemInvalida;

  constructor(motivo: MotivoImagemInvalida) {
    super(`Imagem inválida: ${motivo}`);
    this.name = 'ImagemInvalidaError';
    this.motivo = motivo;
  }
}

export interface ImagemProcessada {
  foto: Buffer;
  miniatura: Buffer;
}

async function versaoJpeg(
  entrada: Buffer,
  { lado, qualidade }: { lado: number; qualidade: number },
): Promise<Buffer> {
  return sharp(entrada, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .autoOrient()
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // PNG/WebP com transparência: fundo branco no JPEG
    .jpeg({ quality: qualidade, mozjpeg: true })
    .toBuffer();
}

export async function processarImagem(entrada: Buffer): Promise<ImagemProcessada> {
  let formato: string | undefined;
  let largura = 0;
  let altura = 0;

  try {
    ({ format: formato, width: largura, height: altura } = await sharp(entrada).metadata());
  } catch {
    throw new ImagemInvalidaError('formato');
  }

  if (formato === undefined || !FORMATOS_ACEITOS.has(formato)) {
    throw new ImagemInvalidaError('formato');
  }
  if (largura * altura > MAX_PIXELS) {
    throw new ImagemInvalidaError('dimensoes');
  }

  try {
    const [foto, miniatura] = await Promise.all([
      versaoJpeg(entrada, FOTO),
      versaoJpeg(entrada, MINIATURA),
    ]);
    return { foto, miniatura };
  } catch {
    // Cabeçalho válido, mas o conteúdo não decodifica (arquivo truncado/corrompido).
    throw new ImagemInvalidaError('corrompida');
  }
}

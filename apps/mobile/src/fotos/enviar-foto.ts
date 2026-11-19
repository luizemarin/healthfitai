import { File } from 'expo-file-system';

import { fotosApi } from './fotos-api';
import { falhaPassageira } from './fotos-formato';
import { ApiError } from '../api/api-error';

import type { ArquivoFoto } from './escolher-foto';
import type { Envio, Foto } from './fotos-api';
import type { Identificacao } from '../questionario/submissoes-api';

/** Tentativas automáticas de cada passo (com espera entre elas) antes de mostrar o erro. */
const ESPERAS_MS = [1000, 3000] as const;

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Repete o passo em falha passageira (sem conexão, servidor fora); outras falhas sobem na hora. */
async function comRetentativa<T>(passo: () => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      // Uma tentativa depois da outra, de propósito.
      return await passo();
    } catch (error) {
      const espera = ESPERAS_MS[tentativa];
      if (espera === undefined || !falhaPassageira(error)) {
        throw error;
      }
      console.warn(`[fotos] Falha passageira; nova tentativa em ${String(espera)} ms.`, error);
      await esperar(espera);
    }
  }
}

/** Manda o arquivo direto ao storage (PUT na URL assinada), com os headers da assinatura. */
async function subirArquivo(arquivo: ArquivoFoto, envio: Envio): Promise<void> {
  let status: number;
  try {
    ({ status } = await new File(arquivo.uri).upload(envio.url, {
      httpMethod: envio.metodo,
      headers: envio.headers,
    }));
  } catch {
    throw ApiError.network();
  }
  if (status < 200 || status >= 300) {
    // 403 = assinatura recusada (ex.: URL expirou). Mensagem para o aluno: o storage não manda uma.
    throw new ApiError(status, 'UPLOAD_RECUSADO', 'Não conseguimos enviar a foto. Tente de novo.');
  }
}

/**
 * MB-FOT-01 · Envio de uma foto, nos 2 passos do BE-FOT-02:
 *   1) pede a URL assinada  2) sobe o arquivo nela  3) confirma (a API processa e cria a foto).
 * Cada passo tenta de novo sozinho em falha passageira. Se ainda assim falhar, lança ApiError
 * e a tela oferece "Tentar de novo" com a mesma foto (recomeça do passo 1, com um envio novo).
 */
export async function enviarFoto(
  quem: Identificacao,
  poseId: string,
  arquivo: ArquivoFoto,
): Promise<Foto> {
  const envio = await comRetentativa(async () =>
    fotosApi.criarEnvio(quem, { poseId, tipoArquivo: arquivo.tipo, tamanho: arquivo.tamanho }),
  );
  await comRetentativa(async () => subirArquivo(arquivo, envio));
  return comRetentativa(async () => fotosApi.confirmarEnvio(quem, envio.confirmacao));
}

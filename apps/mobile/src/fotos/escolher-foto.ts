import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';

import type { ImagePickerOptions, ImagePickerResult } from 'expo-image-picker';

/** Foto pronta para enviar: sempre JPEG, com o tamanho exato em bytes (vai na assinatura do envio). */
export interface ArquivoFoto {
  uri: string;
  tamanho: number;
  tipo: 'image/jpeg';
}

export type Escolha =
  | { tipo: 'pronta'; arquivo: ArquivoFoto }
  | { tipo: 'cancelada' }
  /** Câmera negada. `abrirAjustes`: o sistema não pergunta mais; só nos ajustes do aparelho. */
  | { tipo: 'sem-permissao'; abrirAjustes: boolean }
  | { tipo: 'falhou' };

/**
 * Iguais no iOS e no Android:
 * - sem recorte (allowsEditing): a tela de recorte é diferente em cada sistema;
 * - só imagens, uma por vez, sem EXIF (o back já remove; não precisa nem sair do aparelho).
 */
const OPCOES: ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: false,
  allowsMultipleSelection: false,
  exif: false,
  quality: 1,
};

/** Qualidade do JPEG enviado: a API ainda comprime de novo (BE-FOT-03); aqui só deixa o envio leve. */
const QUALIDADE_JPEG = 0.8;

/**
 * Converte para JPEG. A galeria do iPhone guarda em HEIC e a do Android pode ter PNG/WebP;
 * convertendo aqui, o envio é igual nos dois e sempre num tipo que a API aceita.
 */
async function paraJpeg(uri: string): Promise<ArquivoFoto> {
  const imagem = await ImageManipulator.manipulate(uri).renderAsync();
  const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE_JPEG });
  return { uri: salva.uri, tamanho: new File(salva.uri).size, tipo: 'image/jpeg' };
}

async function preparar(abrir: () => Promise<ImagePickerResult>): Promise<Escolha> {
  try {
    const resultado = await abrir();
    const asset = resultado.canceled ? undefined : resultado.assets[0];
    if (!asset) {
      return { tipo: 'cancelada' };
    }
    return { tipo: 'pronta', arquivo: await paraJpeg(asset.uri) };
  } catch (error) {
    console.error('[fotos] Falha ao obter a foto.', error);
    return { tipo: 'falhou' };
  }
}

/** Câmera: pede a permissão (só na primeira vez o sistema mostra a pergunta). */
export async function tirarFoto(): Promise<Escolha> {
  try {
    const permissao = await requestCameraPermissionsAsync();
    if (!permissao.granted) {
      return { tipo: 'sem-permissao', abrirAjustes: !permissao.canAskAgain };
    }
  } catch (error) {
    console.error('[fotos] Falha ao pedir permissão da câmera.', error);
    return { tipo: 'falhou' };
  }
  return preparar(async () => launchCameraAsync(OPCOES));
}

/**
 * Galeria: o seletor de fotos do sistema (iOS 14+ e Android 13+) não pede permissão nos dois;
 * o aluno só vê e escolhe a foto que quer enviar.
 */
export async function escolherDaGaleria(): Promise<Escolha> {
  return preparar(async () => launchImageLibraryAsync(OPCOES));
}

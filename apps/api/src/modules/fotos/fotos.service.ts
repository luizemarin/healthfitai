import { randomUUID } from 'node:crypto';

import { CONTENT_TYPE_PROCESSADO, ImagemInvalidaError, processarImagem } from './fotos.imagem';
import { hojeEmBrasilia } from './fotos.schemas';
import { AppError } from '../../shared/errors/app-error';
import { paginate, toSkipTake } from '../../shared/http/pagination';

import type { MotivoImagemInvalida } from './fotos.imagem';
import type { Foto, FotosRepository, PoseFoto } from './fotos.repository';
import type {
  CompararFotosQuery,
  ConfirmarEnvioBody,
  CriarEnvioBody,
  ListarFotosQuery,
} from './fotos.schemas';
import type { Paginated } from '../../shared/http/pagination';
import type { ObjectStorage } from '../../shared/storage/object-storage';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';

export interface FotosConfig {
  /** Maior arquivo aceito no envio, em bytes (FOTO_TAMANHO_MAXIMO_MB). */
  tamanhoMaximoBytes: number;
  /** Validade das URLs para ver as fotos (FOTO_URL_VALIDADE_SEGUNDOS). */
  urlValidadeSegundos: number;
}

/** BE-FOT-01 · Limite de poses ativas por profissional. */
export const MAX_POSES_ATIVAS = 10;

/** BE-FOT-02 · Validade da URL de envio: dá tempo de subir a foto em rede móvel lenta. */
const ENVIO_VALIDADE_SEGUNDOS = 10 * 60;

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

const MENSAGENS_IMAGEM: Record<MotivoImagemInvalida, string> = {
  formato: 'O arquivo enviado não é uma imagem JPEG, PNG ou WebP.',
  dimensoes: 'A imagem tem resolução grande demais. Envie uma foto de até 50 megapixels.',
  corrompida: 'Não foi possível ler a imagem: o arquivo parece estar incompleto ou corrompido.',
};

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: () =>
    new AppError(409, 'ALUNO_INATIVO', 'O aluno está inativo. Reative o aluno para enviar fotos.'),
  poseNaoEncontrada: () => AppError.notFound('Pose não encontrada.'),
  poseInativa: (nome: string) =>
    new AppError(
      409,
      'POSE_INATIVA',
      `A pose "${nome}" está desativada. Ative a pose ou escolha outra.`,
    ),
  poseJaAtiva: () => new AppError(409, 'POSE_JA_ATIVA', 'A pose já está ativa.'),
  poseJaInativa: () => new AppError(409, 'POSE_JA_INATIVA', 'A pose já está desativada.'),
  poseDuplicada: (nome: string) =>
    new AppError(409, 'POSE_DUPLICADA', `Já existe uma pose ativa chamada "${nome}".`),
  limitePoses: () =>
    new AppError(
      409,
      'LIMITE_POSES',
      `Você pode ter no máximo ${MAX_POSES_ATIVAS} poses ativas. Desative uma antes de adicionar outra.`,
    ),
  ultimaPoseAtiva: () =>
    new AppError(
      409,
      'ULTIMA_POSE_ATIVA',
      'Esta é a única pose ativa e não pode ser desativada: o app precisa de pelo menos uma pose.',
    ),
  arquivoMuitoGrande: (maximo: number) =>
    new AppError(413, 'ARQUIVO_MUITO_GRANDE', `A foto deve ter no máximo ${formatarMb(maximo)}.`),
  envioNaoEncontrado: () =>
    new AppError(
      404,
      'ENVIO_NAO_ENCONTRADO',
      'O arquivo da foto não foi encontrado. O envio pode ter falhado ou expirado. ' +
        'Peça um novo envio e mande a foto de novo.',
    ),
  imagemInvalida: (motivo: MotivoImagemInvalida) =>
    new AppError(400, 'IMAGEM_INVALIDA', MENSAGENS_IMAGEM[motivo]),
  semFotosNaData: (data: string) =>
    new AppError(404, 'SEM_FOTOS_NA_DATA', `O aluno não tem fotos em ${formatarData(data)}.`),
};

/** Mesmo nome = ignora maiúsculas, acentos e espaços nas pontas ("Frente" = " frente "). */
function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
}

function encontrarPose(poses: PoseFoto[], id: string): PoseFoto {
  const pose = poses.find((item) => item.id === id);
  if (!pose) {
    throw Erros.poseNaoEncontrada();
  }
  return pose;
}

/** Próxima posição livre: depois da maior ordem já usada. */
function proximaOrdem(poses: PoseFoto[]): number {
  return Math.max(0, ...poses.map((pose) => pose.ordem)) + 1;
}

/** Antes de criar ou reativar: nome livre entre as ativas e limite de poses. */
function garantirVagaENomeLivre(poses: PoseFoto[], nome: string): void {
  const ativas = poses.filter((pose) => pose.ativa);
  if (ativas.some((pose) => mesmoNome(pose.nome, nome))) {
    throw Erros.poseDuplicada(nome);
  }
  if (ativas.length >= MAX_POSES_ATIVAS) {
    throw Erros.limitePoses();
  }
}

/**
 * Chaves no bucket. O envio fica em "envios/" até ser confirmado (o bucket deve
 * ter uma regra de expiração para esse prefixo, ex.: 1 dia, que limpa envios
 * abandonados). A pose e a data fazem parte da chave assinada: na confirmação,
 * se elas não baterem com as do pedido, o arquivo simplesmente não é achado.
 */
function chaveDoEnvio(alunoId: string, body: ConfirmarEnvioBody): string {
  return `envios/${alunoId}/${body.poseId}/${body.dataRegistro}/${body.envioId}`;
}

function chavesDaFoto(alunoId: string): { foto: string; miniatura: string } {
  const id = randomUUID();
  return { foto: `fotos/${alunoId}/${id}.jpg`, miniatura: `fotos/${alunoId}/${id}-miniatura.jpg` };
}

export interface EnvioCriado {
  envioId: string;
  url: string;
  contentType: string;
  expiraEm: Date;
  confirmacao: ConfirmarEnvioBody;
}

/** Foto pronta para exibir: com a pose e as URLs assinadas. */
export interface FotoVisivel {
  foto: Foto;
  pose: PoseFoto;
  url: string;
  miniaturaUrl: string | null;
  urlsExpiramEm: Date;
}

export interface FotosDoDia {
  dataRegistro: string;
  fotos: FotoVisivel[];
}

export interface ComparacaoPose {
  pose: PoseFoto;
  antes: FotoVisivel | null;
  depois: FotoVisivel | null;
}

export interface Comparacao {
  antes: string;
  depois: string;
  poses: ComparacaoPose[];
}

/**
 * Fotos de evolução do aluno.
 *   BE-FOT-01 · poses configuráveis (padrão: frente, perfil e costas)
 *   BE-FOT-02 · envio seguro: URL assinada, limite de tamanho/tipo, bucket privado
 *   BE-FOT-03 · processamento: compressão, miniatura e remoção de EXIF (fotos.imagem.ts)
 *   BE-FOT-04 · galeria agrupada por data e comparador antes/depois por pose
 * Não conhece HTTP/Express.
 */
export class FotosService {
  private readonly repository: FotosRepository;

  private readonly alunos: AlunosRepository;

  private readonly storage: ObjectStorage;

  private readonly config: FotosConfig;

  constructor(
    repository: FotosRepository,
    alunos: AlunosRepository,
    storage: ObjectStorage,
    config: FotosConfig,
  ) {
    this.repository = repository;
    this.alunos = alunos;
    this.storage = storage;
    this.config = config;
  }

  // ─── BE-FOT-01 · Poses ────────────────────────────────────────────────────

  /** Na primeira vez, o profissional recebe a cópia das poses padrão. */
  async listarPoses(profissionalId: string, ativa?: boolean): Promise<PoseFoto[]> {
    const poses = await this.posesDoProfissional(profissionalId);
    return ativa === undefined ? poses : poses.filter((pose) => pose.ativa === ativa);
  }

  /** A pose nova entra no fim da lista. */
  async criarPose(profissionalId: string, nome: string): Promise<PoseFoto> {
    const poses = await this.posesDoProfissional(profissionalId);
    garantirVagaENomeLivre(poses, nome);

    return this.repository.criarPose({ profissionalId, nome, ordem: proximaOrdem(poses) });
  }

  async renomearPose(profissionalId: string, id: string, nome: string): Promise<PoseFoto> {
    const poses = await this.posesDoProfissional(profissionalId);
    const pose = encontrarPose(poses, id);
    if (!pose.ativa) {
      throw Erros.poseInativa(pose.nome);
    }
    if (poses.some((outra) => outra.ativa && outra.id !== id && mesmoNome(outra.nome, nome))) {
      throw Erros.poseDuplicada(nome);
    }

    return this.atualizar(profissionalId, id, { nome });
  }

  /** "Remover" a pose: some do app, mas as fotos antigas continuam ligadas a ela. */
  async desativarPose(profissionalId: string, id: string): Promise<PoseFoto> {
    const poses = await this.posesDoProfissional(profissionalId);
    const pose = encontrarPose(poses, id);
    if (!pose.ativa) {
      throw Erros.poseJaInativa();
    }
    if (poses.filter((outra) => outra.ativa).length === 1) {
      throw Erros.ultimaPoseAtiva();
    }

    return this.atualizar(profissionalId, id, { ativa: false });
  }

  /** A pose reativada volta no fim da lista. */
  async ativarPose(profissionalId: string, id: string): Promise<PoseFoto> {
    const poses = await this.posesDoProfissional(profissionalId);
    const pose = encontrarPose(poses, id);
    if (pose.ativa) {
      throw Erros.poseJaAtiva();
    }
    garantirVagaENomeLivre(poses, pose.nome);

    return this.atualizar(profissionalId, id, { ativa: true, ordem: proximaOrdem(poses) });
  }

  /**
   * Recebe TODAS as poses ativas, na nova ordem. As inativas vão para o fim,
   * mantendo a ordem relativa entre elas.
   */
  async reordenarPoses(profissionalId: string, ids: string[]): Promise<PoseFoto[]> {
    const poses = await this.posesDoProfissional(profissionalId);
    const ativas = poses.filter((pose) => pose.ativa);
    const idsAtivos = new Set(ativas.map((pose) => pose.id));

    const invalidos = ids.filter((id) => !idsAtivos.has(id));
    const faltando = ativas.filter((pose) => !ids.includes(pose.id));

    if (invalidos.length > 0 || faltando.length > 0) {
      const details = [
        ...invalidos.map((id) => ({
          field: 'body.ids',
          message: `A pose ${id} não existe ou está desativada.`,
        })),
        ...(faltando.length > 0
          ? [
              {
                field: 'body.ids',
                message: `Faltam as poses: ${faltando.map((pose) => pose.nome).join(', ')}.`,
              },
            ]
          : []),
      ];
      throw AppError.validation(
        details,
        'Envie todas as poses ativas, cada uma uma vez, na nova ordem.',
      );
    }

    const inativas = poses.filter((pose) => !pose.ativa).map((pose) => pose.id);
    return this.repository.reordenarPoses(profissionalId, [...ids, ...inativas]);
  }

  // ─── BE-FOT-02 · Envio seguro (2 passos) ──────────────────────────────────

  /**
   * Passo 1: valida e devolve a URL assinada para o cliente mandar o arquivo
   * DIRETO ao bucket (o arquivo não passa pela API). Tipo e tamanho fazem
   * parte da assinatura: o bucket recusa um arquivo diferente do declarado.
   */
  async criarEnvio(
    profissionalId: string,
    alunoId: string,
    body: CriarEnvioBody,
  ): Promise<EnvioCriado> {
    await this.alunoAtivo(profissionalId, alunoId);
    await this.poseAtiva(profissionalId, body.poseId);

    if (body.tamanho > this.config.tamanhoMaximoBytes) {
      throw Erros.arquivoMuitoGrande(this.config.tamanhoMaximoBytes);
    }

    const confirmacao: ConfirmarEnvioBody = {
      envioId: randomUUID(),
      poseId: body.poseId,
      dataRegistro: body.dataRegistro ?? hojeEmBrasilia(),
    };

    const url = await this.storage.urlDeEnvio(chaveDoEnvio(alunoId, confirmacao), {
      contentType: body.tipoArquivo,
      tamanho: body.tamanho,
      expiraEmSegundos: ENVIO_VALIDADE_SEGUNDOS,
    });

    return {
      envioId: confirmacao.envioId,
      url,
      contentType: body.tipoArquivo,
      expiraEm: new Date(Date.now() + ENVIO_VALIDADE_SEGUNDOS * 1000),
      confirmacao,
    };
  }

  /**
   * Passo 2: depois do PUT, o cliente confirma. A API confere o arquivo,
   * processa (BE-FOT-03), guarda a foto e a miniatura e apaga o envio.
   * Chamar de novo para o mesmo envio dá 404: ele já virou foto.
   */
  async confirmarEnvio(
    profissionalId: string,
    alunoId: string,
    body: ConfirmarEnvioBody,
  ): Promise<FotoVisivel> {
    await this.alunoAtivo(profissionalId, alunoId);
    const pose = await this.poseAtiva(profissionalId, body.poseId);

    const chaveEnvio = chaveDoEnvio(alunoId, body);
    const info = await this.storage.info(chaveEnvio);
    if (!info) {
      throw Erros.envioNaoEncontrado();
    }
    if (info.tamanho > this.config.tamanhoMaximoBytes) {
      await this.storage.apagar([chaveEnvio]);
      throw Erros.arquivoMuitoGrande(this.config.tamanhoMaximoBytes);
    }

    const original = await this.storage.baixar(chaveEnvio);
    if (!original) {
      throw Erros.envioNaoEncontrado();
    }

    const imagem = await this.processar(original, chaveEnvio);
    const chaves = chavesDaFoto(alunoId);

    let foto: Foto;
    try {
      await this.storage.salvar(chaves.foto, imagem.foto, CONTENT_TYPE_PROCESSADO);
      await this.storage.salvar(chaves.miniatura, imagem.miniatura, CONTENT_TYPE_PROCESSADO);
      foto = await this.repository.criarFoto({
        alunoId,
        poseId: pose.id,
        dataRegistro: body.dataRegistro,
        storageKey: chaves.foto,
        miniaturaKey: chaves.miniatura,
        tamanho: imagem.foto.length,
        // PROVISÓRIO: só o profissional é identificado hoje (X-Profissional-Id).
        // Com o login (BE-AUT), "aluno" quando o envio vier do app do aluno.
        criadoPor: 'profissional',
      });
    } catch (error) {
      // Não deixa arquivo órfão no bucket se algo falhou no meio do caminho.
      await this.storage.apagar([chaves.foto, chaves.miniatura]).catch(() => undefined);
      throw error;
    }

    // A foto já está salva; se apagar o envio falhar, a regra de expiração do bucket limpa.
    await this.storage.apagar([chaveEnvio]).catch(() => undefined);

    return this.tornarVisivel(foto, pose);
  }

  // ─── BE-FOT-04 · Galeria e comparador ─────────────────────────────────────

  /** Fotos agrupadas por data. A paginação é por DATA (cada página traz dias inteiros). */
  async listarGaleria(
    profissionalId: string,
    alunoId: string,
    query: ListarFotosQuery,
  ): Promise<Paginated<FotosDoDia>> {
    await this.buscarAluno(profissionalId, alunoId);
    const poses = await this.posesDoProfissional(profissionalId);
    if (query.poseId !== undefined) {
      encontrarPose(poses, query.poseId);
    }

    const { datas, total } = await this.repository.listarDatasComFotos(alunoId, {
      poseId: query.poseId,
      de: query.de,
      ate: query.ate,
      direcao: query.sort === 'dataRegistro' ? 'asc' : 'desc',
      ...toSkipTake(query),
    });
    const fotos = await this.repository.listarFotosPorDatas(alunoId, datas, query.poseId);
    const visiveis = await this.tornarVisiveis(fotos, poses);

    const grupos = datas.map((data) => ({
      dataRegistro: data,
      fotos: visiveis.filter((item) => item.foto.dataRegistro === data),
    }));

    return paginate(grupos, total, query);
  }

  /**
   * Antes/depois: uma linha por pose, com a foto de cada data. Se houver mais
   * de uma foto da mesma pose no dia, vale a mais recente (tirou de novo).
   */
  async comparar(
    profissionalId: string,
    alunoId: string,
    query: CompararFotosQuery,
  ): Promise<Comparacao> {
    await this.buscarAluno(profissionalId, alunoId);
    const poses = await this.posesDoProfissional(profissionalId);

    const fotos = await this.repository.listarFotosPorDatas(alunoId, [query.antes, query.depois]);
    [query.antes, query.depois].forEach((data) => {
      if (!fotos.some((foto) => foto.dataRegistro === data)) {
        throw Erros.semFotosNaData(data);
      }
    });

    const visiveis = await this.tornarVisiveis(fotos, poses);
    const maisRecente = (poseId: string, data: string): FotoVisivel | null =>
      visiveis
        .filter((item) => item.pose.id === poseId && item.foto.dataRegistro === data)
        .reduce<FotoVisivel | null>(
          (atual, item) => (!atual || item.foto.criadoEm > atual.foto.criadoEm ? item : atual),
          null,
        );

    const linhas = poses
      .map((pose) => ({
        pose,
        antes: maisRecente(pose.id, query.antes),
        depois: maisRecente(pose.id, query.depois),
      }))
      .filter((linha) => linha.antes !== null || linha.depois !== null);

    return { antes: query.antes, depois: query.depois, poses: linhas };
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private async posesDoProfissional(profissionalId: string): Promise<PoseFoto[]> {
    await this.repository.garantirPosesIniciais(profissionalId);
    return this.repository.listarPoses(profissionalId);
  }

  private async atualizar(
    profissionalId: string,
    id: string,
    alteracoes: Parameters<FotosRepository['atualizarPose']>[2],
  ): Promise<PoseFoto> {
    const pose = await this.repository.atualizarPose(profissionalId, id, alteracoes);
    if (!pose) {
      throw Erros.poseNaoEncontrada();
    }
    return pose;
  }

  private async poseAtiva(profissionalId: string, id: string): Promise<PoseFoto> {
    const pose = encontrarPose(await this.posesDoProfissional(profissionalId), id);
    if (!pose.ativa) {
      throw Erros.poseInativa(pose.nome);
    }
    return pose;
  }

  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async alunoAtivo(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo();
    }
    return aluno;
  }

  /** BE-FOT-03 · Se o arquivo não serve, apaga o envio e responde 400 com o motivo. */
  private async processar(
    original: Buffer,
    chaveEnvio: string,
  ): Promise<Awaited<ReturnType<typeof processarImagem>>> {
    try {
      return await processarImagem(original);
    } catch (error) {
      if (error instanceof ImagemInvalidaError) {
        await this.storage.apagar([chaveEnvio]).catch(() => undefined);
        throw Erros.imagemInvalida(error.motivo);
      }
      throw error;
    }
  }

  private async tornarVisivel(foto: Foto, pose: PoseFoto): Promise<FotoVisivel> {
    const segundos = this.config.urlValidadeSegundos;
    const [url, miniaturaUrl] = await Promise.all([
      this.storage.urlDeLeitura(foto.storageKey, segundos),
      foto.miniaturaKey ? this.storage.urlDeLeitura(foto.miniaturaKey, segundos) : null,
    ]);
    return { foto, pose, url, miniaturaUrl, urlsExpiramEm: new Date(Date.now() + segundos * 1000) };
  }

  /** Assina as URLs e ordena por pose (ordem da lista) e, na mesma pose, por envio. */
  private async tornarVisiveis(fotos: Foto[], poses: PoseFoto[]): Promise<FotoVisivel[]> {
    const posePorId = new Map(poses.map((pose) => [pose.id, pose]));
    const visiveis = await Promise.all(
      fotos.flatMap((foto) => {
        const pose = posePorId.get(foto.poseId);
        return pose ? [this.tornarVisivel(foto, pose)] : [];
      }),
    );
    return visiveis.sort(
      (a, b) =>
        a.pose.ordem - b.pose.ordem || a.foto.criadoEm.getTime() - b.foto.criadoEm.getTime(),
    );
  }
}

import type { PAPEIS } from './fotos.schemas';

/**
 * Contrato de acesso a dados de poses (DB-014) e fotos (DB-015). O service só
 * conhece esta interface; hoje a implementação é em memória e, com o Prisma,
 * entra a implementação com banco sem mexer no service.
 *
 * Poses: toda operação recebe o profissionalId (pose de outro profissional =
 * "não encontrada"). Fotos: o service confere antes que o aluno é do
 * profissional; aqui as consultas são por alunoId.
 *
 * O arquivo da foto NÃO passa por aqui: fica no storage (R2). A foto guarda só
 * as chaves dos arquivos no bucket.
 */

export type Papel = (typeof PAPEIS)[number];

export interface PoseFoto {
  /** UUID. No banco é gerado pelo Postgres (gen_random_uuid()). */
  id: string;
  profissionalId: string;
  nome: string;
  /** Posição na lista (1, 2, 3...): é a ordem em que o app pede as fotos. */
  ordem: number;
  /** Remover = desativar: as fotos antigas continuam apontando para a pose. */
  ativa: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type NovaPose = Pick<PoseFoto, 'profissionalId' | 'nome' | 'ordem'>;

/** Campos alteráveis; ausente = não alterar. */
export type AlteracoesPose = Partial<Pick<PoseFoto, 'nome' | 'ordem' | 'ativa'>>;

export interface Foto {
  id: string;
  alunoId: string;
  poseId: string;
  /** AAAA-MM-DD. A galeria agrupa e o comparador escolhe as datas por aqui. */
  dataRegistro: string;
  /** Chave da foto (já comprimida e sem EXIF) no bucket. */
  storageKey: string;
  /** Chave da miniatura no bucket (BE-FOT-03). */
  miniaturaKey: string | null;
  /** Tamanho da foto processada, em bytes. */
  tamanho: number;
  criadoPor: Papel;
  criadoEm: Date;
}

export type NovaFoto = Omit<Foto, 'id' | 'criadoEm'>;

export interface FiltrosDatasComFotos {
  poseId?: string | undefined;
  /** AAAA-MM-DD, inclusive. */
  de?: string | undefined;
  /** AAAA-MM-DD, inclusive. */
  ate?: string | undefined;
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

export interface PaginaDatas {
  /** Datas (AAAA-MM-DD) que têm pelo menos uma foto, na ordem pedida. */
  datas: string[];
  total: number;
}

export interface FotosRepository {
  // ─── Poses (BE-FOT-01) ──────────────────────────────────────────────────

  /**
   * Se o profissional ainda não tem nenhuma pose, copia as padrão do sistema
   * (frente, perfil e costas) para ele. Se já tem, não faz nada.
   * No banco: numa transação, lendo as poses com profissional_id NULL.
   */
  garantirPosesIniciais: (profissionalId: string) => Promise<void>;
  /** Todas as poses do profissional (ativas e inativas), por ordem. */
  listarPoses: (profissionalId: string) => Promise<PoseFoto[]>;
  buscarPose: (profissionalId: string, id: string) => Promise<PoseFoto | null>;
  criarPose: (dados: NovaPose) => Promise<PoseFoto>;
  /** Retorna null se a pose não existir para o profissional. */
  atualizarPose: (
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesPose,
  ) => Promise<PoseFoto | null>;
  /**
   * Grava a ordem = posição na lista (1, 2, 3...) para cada id enviado.
   * No banco: numa transação. Retorna as poses por ordem.
   */
  reordenarPoses: (profissionalId: string, idsEmOrdem: readonly string[]) => Promise<PoseFoto[]>;

  // ─── Fotos (BE-FOT-02 e BE-FOT-04) ──────────────────────────────────────

  criarFoto: (dados: NovaFoto) => Promise<Foto>;
  /** Página de datas que têm fotos do aluno (a galeria pagina por data, não por foto). */
  listarDatasComFotos: (alunoId: string, filtros: FiltrosDatasComFotos) => Promise<PaginaDatas>;
  /** Fotos do aluno nas datas pedidas (opcionalmente de uma pose só). */
  listarFotosPorDatas: (
    alunoId: string,
    datas: readonly string[],
    poseId?: string,
  ) => Promise<Foto[]>;
}

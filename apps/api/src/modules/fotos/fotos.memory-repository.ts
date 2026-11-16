import { randomUUID } from 'node:crypto';

import { POSES_PADRAO } from './fotos.padroes';

import type { PosePadrao } from './fotos.padroes';
import type {
  AlteracoesPose,
  FiltrosDatasComFotos,
  Foto,
  FotosRepository,
  NovaFoto,
  NovaPose,
  PaginaDatas,
  PoseFoto,
} from './fotos.repository';

function porOrdem(a: PoseFoto, b: PoseFoto): number {
  return a.ordem - b.ordem || a.criadoEm.getTime() - b.criadoEm.getTime();
}

/**
 * Implementação em memória, PROVISÓRIA até o Prisma (tabelas poses_foto e
 * fotos). Os dados somem ao reiniciar a API. Imita o banco: gera os UUIDs e
 * nunca altera uma foto já criada. As poses padrão vêm da mesma lista do seed.
 */
export class InMemoryFotosRepository implements FotosRepository {
  private readonly poses = new Map<string, PoseFoto>();

  private readonly fotos = new Map<string, Foto>();

  private readonly padroes: readonly PosePadrao[];

  constructor(padroes: readonly PosePadrao[] = POSES_PADRAO) {
    this.padroes = padroes;
  }

  // ─── Poses ────────────────────────────────────────────────────────────────

  async garantirPosesIniciais(profissionalId: string): Promise<void> {
    const jaTem = [...this.poses.values()].some((pose) => pose.profissionalId === profissionalId);
    if (jaTem) {
      return;
    }
    this.padroes.forEach((padrao) => {
      this.inserirPose({ profissionalId, nome: padrao.nome, ordem: padrao.ordem });
    });
  }

  async listarPoses(profissionalId: string): Promise<PoseFoto[]> {
    return [...this.poses.values()]
      .filter((pose) => pose.profissionalId === profissionalId)
      .sort(porOrdem)
      .map((pose) => structuredClone(pose));
  }

  async buscarPose(profissionalId: string, id: string): Promise<PoseFoto | null> {
    const pose = this.buscar(profissionalId, id);
    return pose ? structuredClone(pose) : null;
  }

  async criarPose(dados: NovaPose): Promise<PoseFoto> {
    return structuredClone(this.inserirPose(dados));
  }

  async atualizarPose(
    profissionalId: string,
    id: string,
    alteracoes: AlteracoesPose,
  ): Promise<PoseFoto | null> {
    const pose = this.buscar(profissionalId, id);
    if (!pose) {
      return null;
    }
    const atualizada: PoseFoto = { ...pose, ...alteracoes, atualizadoEm: new Date() };
    this.poses.set(id, atualizada);
    return structuredClone(atualizada);
  }

  async reordenarPoses(profissionalId: string, idsEmOrdem: readonly string[]): Promise<PoseFoto[]> {
    const agora = new Date();
    idsEmOrdem.forEach((id, indice) => {
      const pose = this.buscar(profissionalId, id);
      if (pose) {
        this.poses.set(id, { ...pose, ordem: indice + 1, atualizadoEm: agora });
      }
    });
    return this.listarPoses(profissionalId);
  }

  // ─── Fotos ────────────────────────────────────────────────────────────────

  async criarFoto(dados: NovaFoto): Promise<Foto> {
    const foto: Foto = { ...dados, id: randomUUID(), criadoEm: new Date() };
    this.fotos.set(foto.id, foto);
    return structuredClone(foto);
  }

  async listarDatasComFotos(alunoId: string, filtros: FiltrosDatasComFotos): Promise<PaginaDatas> {
    const datas = new Set(
      [...this.fotos.values()]
        .filter(
          (foto) =>
            foto.alunoId === alunoId &&
            (filtros.poseId === undefined || foto.poseId === filtros.poseId) &&
            (filtros.de === undefined || foto.dataRegistro >= filtros.de) &&
            (filtros.ate === undefined || foto.dataRegistro <= filtros.ate),
        )
        .map((foto) => foto.dataRegistro),
    );

    // Datas AAAA-MM-DD ordenam corretamente como texto.
    const ordenadas = [...datas].sort();
    if (filtros.direcao === 'desc') {
      ordenadas.reverse();
    }

    return {
      datas: ordenadas.slice(filtros.skip, filtros.skip + filtros.take),
      total: ordenadas.length,
    };
  }

  async listarFotosPorDatas(
    alunoId: string,
    datas: readonly string[],
    poseId?: string,
  ): Promise<Foto[]> {
    return [...this.fotos.values()]
      .filter(
        (foto) =>
          foto.alunoId === alunoId &&
          datas.includes(foto.dataRegistro) &&
          (poseId === undefined || foto.poseId === poseId),
      )
      .map((foto) => structuredClone(foto));
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

  private inserirPose(dados: NovaPose): PoseFoto {
    const agora = new Date();
    const pose: PoseFoto = {
      ...dados,
      id: randomUUID(),
      ativa: true,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.poses.set(pose.id, pose);
    return pose;
  }

  private buscar(profissionalId: string, id: string): PoseFoto | undefined {
    const pose = this.poses.get(id);
    return pose?.profissionalId === profissionalId ? pose : undefined;
  }
}

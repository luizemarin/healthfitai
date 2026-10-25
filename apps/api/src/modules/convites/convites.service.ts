import { gerarToken, hashToken } from './convites.token';
import { AppError } from '../../shared/errors/app-error';

import type { Convite, ConvitesRepository } from './convites.repository';
import type { Aluno, AlunosRepository } from '../alunos/alunos.repository';

const HORA_EM_MS = 60 * 60 * 1000;

/** Erros de negócio do módulo (código próprio para o front decidir o que mostrar). */
const Erros = {
  alunoNaoEncontrado: () => AppError.notFound('Aluno não encontrado.'),
  alunoInativo: () =>
    new AppError(
      409,
      'ALUNO_INATIVO',
      'O aluno está inativo. Ative o aluno antes de gerar um convite.',
    ),
  conviteJaValido: () =>
    new AppError(
      409,
      'CONVITE_JA_VALIDO',
      'Este aluno já tem um convite válido. Use "reenviar" para gerar um novo link ou revogue o atual.',
    ),
  semConviteValido: () =>
    new AppError(409, 'SEM_CONVITE_VALIDO', 'Este aluno não tem convite válido para revogar.'),
};

export interface ConvitesConfig {
  /** Página que o aluno abre (ex.: https://app.healthfitai.com/convite). */
  urlBase: string;
  /** Validade do link em horas. */
  validadeHoras: number;
}

/** Convite recém-gerado: o link (com o token puro) só existe nesta resposta. */
export interface ConviteGerado {
  convite: Convite;
  link: string;
}

/**
 * BE-ALU-04 · Regras do convite por link único.
 *   gerar    → cria o convite (só se o aluno estiver ativo e sem convite válido)
 *   reenviar → revoga o válido (se houver) e cria outro: o link antigo para de funcionar
 *   revogar  → revoga o válido; o link para de funcionar
 *   listar   → histórico do aluno com o status calculado
 * Uso único e expiração: o convite guarda expiraEm e usadoEm. Quem marca o uso
 * é a ativação da conta pelo aluno (BE-AUT-02).
 */
export class ConvitesService {
  private readonly alunos: AlunosRepository;

  private readonly convites: ConvitesRepository;

  private readonly config: ConvitesConfig;

  constructor(alunos: AlunosRepository, convites: ConvitesRepository, config: ConvitesConfig) {
    this.alunos = alunos;
    this.convites = convites;
    this.config = config;
  }

  async gerar(profissionalId: string, alunoId: string): Promise<ConviteGerado> {
    await this.buscarAlunoAtivo(profissionalId, alunoId);

    const existente = await this.convites.findValidoByAluno(alunoId, new Date());
    if (existente) {
      throw Erros.conviteJaValido();
    }

    return this.criarConvite(alunoId);
  }

  async reenviar(profissionalId: string, alunoId: string): Promise<ConviteGerado> {
    await this.buscarAlunoAtivo(profissionalId, alunoId);

    await this.convites.revogarValidos(alunoId, new Date());
    return this.criarConvite(alunoId);
  }

  async revogar(profissionalId: string, alunoId: string): Promise<void> {
    await this.buscarAluno(profissionalId, alunoId);

    const revogados = await this.convites.revogarValidos(alunoId, new Date());
    if (revogados === 0) {
      throw Erros.semConviteValido();
    }
  }

  async listar(profissionalId: string, alunoId: string): Promise<Convite[]> {
    await this.buscarAluno(profissionalId, alunoId);
    return this.convites.listByAluno(alunoId);
  }

  private async criarConvite(alunoId: string): Promise<ConviteGerado> {
    const token = gerarToken();
    const convite = await this.convites.create({
      alunoId,
      tokenHash: hashToken(token),
      expiraEm: new Date(Date.now() + this.config.validadeHoras * HORA_EM_MS),
    });

    return { convite, link: this.montarLink(token) };
  }

  private montarLink(token: string): string {
    const url = new URL(this.config.urlBase);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /** Aluno de outro profissional = "não encontrado" (não revela que existe). */
  private async buscarAluno(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.alunos.findById(profissionalId, alunoId);
    if (!aluno) {
      throw Erros.alunoNaoEncontrado();
    }
    return aluno;
  }

  private async buscarAlunoAtivo(profissionalId: string, alunoId: string): Promise<Aluno> {
    const aluno = await this.buscarAluno(profissionalId, alunoId);
    if (!aluno.ativo) {
      throw Erros.alunoInativo();
    }
    return aluno;
  }
}

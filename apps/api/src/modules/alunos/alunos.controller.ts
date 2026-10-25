import {
  alunoIdParamsSchema,
  atualizarAlunoBodySchema,
  criarAlunoBodySchema,
  listarAlunosQuerySchema,
} from './alunos.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler } from 'express';

import type { Aluno } from './alunos.repository';
import type { AlunoResponse, PerfilAlunoResponse } from './alunos.schemas';
import type { AlunosService, PerfilAluno } from './alunos.service';

/** Formato público do aluno (não expõe o profissionalId). */
function toResponse(aluno: Aluno): AlunoResponse {
  return {
    id: aluno.id,
    nome: aluno.nome,
    sexo: aluno.sexo,
    dataNascimento: aluno.dataNascimento,
    email: aluno.email,
    telefone: aluno.telefone,
    ativo: aluno.ativo,
    criadoEm: aluno.criadoEm.toISOString(),
    atualizadoEm: aluno.atualizadoEm.toISOString(),
  };
}

function toPerfilResponse({ aluno, idade }: PerfilAluno): PerfilAlunoResponse {
  return {
    id: aluno.id,
    nome: aluno.nome,
    sexo: aluno.sexo,
    dataNascimento: aluno.dataNascimento,
    idade,
    contato: { email: aluno.email, telefone: aluno.telefone },
    ativo: aluno.ativo,
  };
}

/**
 * HTTP de alunos: valida a entrada, chama o service e monta a resposta.
 * Erros lançados aqui ou no service vão para o errorHandler (Express 5 captura async).
 */
export class AlunosController {
  private readonly service: AlunosService;

  constructor(service: AlunosService) {
    this.service = service;
  }

  criar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { body } = validateRequest(request, { body: criarAlunoBodySchema });

    const aluno = await this.service.criar(profissionalId, body);

    response.status(201).location(`/alunos/${aluno.id}`).json(toResponse(aluno));
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { query } = validateRequest(request, { query: listarAlunosQuerySchema });

    const { data, meta } = await this.service.listar(profissionalId, query);

    response.json({ data: data.map(toResponse), meta });
  };

  buscarPorId: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: alunoIdParamsSchema });

    const aluno = await this.service.buscarPorId(profissionalId, params.id);

    response.json(toResponse(aluno));
  };

  atualizar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params, body } = validateRequest(request, {
      params: alunoIdParamsSchema,
      body: atualizarAlunoBodySchema,
    });

    const aluno = await this.service.atualizar(profissionalId, params.id, body);

    response.json(toResponse(aluno));
  };

  perfil: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: alunoIdParamsSchema });

    const perfil = await this.service.perfil(profissionalId, params.id);

    response.json(toPerfilResponse(perfil));
  };

  desativar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: alunoIdParamsSchema });

    const aluno = await this.service.desativar(profissionalId, params.id);

    response.json(toResponse(aluno));
  };

  ativar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: alunoIdParamsSchema });

    const aluno = await this.service.ativar(profissionalId, params.id);

    response.json(toResponse(aluno));
  };
}

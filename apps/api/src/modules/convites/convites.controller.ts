import { statusDoConvite } from './convites.repository';
import { conviteAlunoParamsSchema } from './convites.schemas';
import { getProfissionalId } from '../../shared/http/profissional-atual';
import { validateRequest } from '../../shared/http/validate-request';

import type { RequestHandler, Response } from 'express';

import type { Convite } from './convites.repository';
import type { ConviteGeradoResponse, ConviteResponse } from './convites.schemas';
import type { ConviteGerado, ConvitesService } from './convites.service';

/** Formato público do convite: sem token nem hash. */
function toResponse(convite: Convite): ConviteResponse {
  return {
    id: convite.id,
    status: statusDoConvite(convite),
    expiraEm: convite.expiraEm.toISOString(),
    usadoEm: convite.usadoEm?.toISOString() ?? null,
    revogadoEm: convite.revogadoEm?.toISOString() ?? null,
    criadoEm: convite.criadoEm.toISOString(),
  };
}

/** 201 com o link. no-store: o link é um segredo e não deve ficar em cache. */
function responderGerado(response: Response, { convite, link }: ConviteGerado): void {
  const body: ConviteGeradoResponse = { ...toResponse(convite), link };
  response.status(201).set('Cache-Control', 'no-store').json(body);
}

/** HTTP de convites (BE-ALU-04). Erros seguem para o errorHandler. */
export class ConvitesController {
  private readonly service: ConvitesService;

  constructor(service: ConvitesService) {
    this.service = service;
  }

  gerar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: conviteAlunoParamsSchema });

    responderGerado(response, await this.service.gerar(profissionalId, params.alunoId));
  };

  reenviar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: conviteAlunoParamsSchema });

    responderGerado(response, await this.service.reenviar(profissionalId, params.alunoId));
  };

  revogar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: conviteAlunoParamsSchema });

    await this.service.revogar(profissionalId, params.alunoId);

    response.status(204).end();
  };

  listar: RequestHandler = async (request, response) => {
    const profissionalId = getProfissionalId(request);
    const { params } = validateRequest(request, { params: conviteAlunoParamsSchema });

    const convites = await this.service.listar(profissionalId, params.alunoId);

    response.json({ data: convites.map(toResponse) });
  };
}

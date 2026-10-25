import { z } from 'zod';

import { STATUS_CONVITE } from './convites.repository';

/**
 * Schemas Zod do módulo: validam a entrada e geram o contrato OpenAPI (fonte única).
 * O token/hash nunca sai na listagem; o link só aparece ao gerar/reenviar.
 */

export const conviteAlunoParamsSchema = z.object({
  alunoId: z.uuid({ error: 'O id do aluno deve ser um UUID válido.' }),
});

export const conviteResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(STATUS_CONVITE),
    expiraEm: z.iso.datetime(),
    usadoEm: z.iso.datetime().nullable(),
    revogadoEm: z.iso.datetime().nullable(),
    criadoEm: z.iso.datetime(),
  })
  .meta({ id: 'Convite' });

export const conviteGeradoResponseSchema = conviteResponseSchema
  .extend({
    link: z.url().meta({
      description: 'Link único para o aluno ativar a conta. Só é mostrado agora: guarde ou envie.',
      example: 'http://localhost:8081/convite?token=Q2xhdWRlLUhlYWx0aEZpdEFJLXRva2VuLWV4ZW1wbG8',
    }),
  })
  .meta({ id: 'ConviteGerado' });

export const listaConvitesResponseSchema = z
  .object({ data: z.array(conviteResponseSchema) })
  .meta({ id: 'ListaConvites' });

export type ConviteResponse = z.output<typeof conviteResponseSchema>;
export type ConviteGeradoResponse = z.output<typeof conviteGeradoResponseSchema>;

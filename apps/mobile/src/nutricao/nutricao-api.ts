import { api, unwrap } from '../api/client';
import { doAluno } from '../questionario/submissoes-api';

import type { components } from '../api/generated/schema';
import type { Identificacao } from '../questionario/submissoes-api';

/**
 * Chamada à API de nutrição usada pelo aluno, tipada pelo contrato OpenAPI.
 *   GET /alunos/:alunoId/planos-nutricionais/ativo → plano em uso, refeições na ordem (BE-NUT-01)
 * Qualquer falha chega como ApiError.
 */
export type PlanoNutricional = components['schemas']['PlanoNutricional'];
export type Refeicao = PlanoNutricional['refeicoes'][number];

export const nutricaoApi = {
  buscarAtivo: async (quem: Identificacao): Promise<PlanoNutricional> =>
    unwrap(api.GET('/alunos/{alunoId}/planos-nutricionais/ativo', { params: doAluno(quem) })),
};

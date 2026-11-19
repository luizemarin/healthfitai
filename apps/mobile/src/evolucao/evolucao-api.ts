import { api, unwrap } from '../api/client';
import { doAluno } from '../questionario/submissoes-api';

import type { components } from '../api/generated/schema';
import type { Identificacao } from '../questionario/submissoes-api';

/**
 * Chamadas à API de peso, medidas e evolução usadas pelo aluno, tipadas pelo contrato OpenAPI.
 *   GET  /tipos-medida?ativo=true      → medidas pedidas pelo treinador, cada uma com a unidade (BE-MED-02)
 *   POST /alunos/:alunoId/pesos        → registra o peso de hoje (BE-MED-01)
 *   POST /alunos/:alunoId/medidas      → registra as medidas de hoje, todas de uma vez (BE-MED-01)
 *   GET  /alunos/:alunoId/evolucao     → séries: peso, medidas e perguntas flagadas (BE-EVO-01)
 * Sem `dataRegistro`, a API usa hoje (horário de Brasília). Qualquer falha chega como ApiError.
 */
type Schemas = components['schemas'];
export type TipoMedida = Schemas['TipoMedida'];
export type Evolucao = Schemas['Evolucao'];
export type SerieMedida = Schemas['SerieEvolucaoMedida'];
export type SeriePergunta = Schemas['SerieEvolucaoPergunta'];
export type Ponto = Schemas['PontoEvolucao'];

export interface MedidaInformada {
  tipoId: string;
  valor: number;
}

export const evolucaoApi = {
  /** Tipos de medida ativos, na ordem em que o treinador criou. */
  tiposMedida: async (quem: Identificacao): Promise<TipoMedida[]> =>
    unwrap(
      api.GET('/tipos-medida', {
        params: { header: doAluno(quem).header, query: { ativo: 'true' } },
      }),
    ).then((lista) => lista.data),

  registrarPeso: async (quem: Identificacao, pesoKg: number): Promise<void> => {
    await unwrap(api.POST('/alunos/{alunoId}/pesos', { params: doAluno(quem), body: { pesoKg } }));
  },

  /** Ou entram todas, ou nenhuma (a API confere tudo antes de gravar). */
  registrarMedidas: async (quem: Identificacao, medidas: MedidaInformada[]): Promise<void> => {
    await unwrap(
      api.POST('/alunos/{alunoId}/medidas', { params: doAluno(quem), body: { medidas } }),
    );
  },

  /** Todas as séries, desde o primeiro registro. Pontos em ordem de data (um por dia). */
  buscar: async (quem: Identificacao): Promise<Evolucao> =>
    unwrap(api.GET('/alunos/{alunoId}/evolucao', { params: doAluno(quem) })),
};

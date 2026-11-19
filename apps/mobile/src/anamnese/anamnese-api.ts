import { api, unwrap } from '../api/client';
import { doAluno, submissoesApi } from '../questionario/submissoes-api';

import type { Identificacao, Submissao } from '../questionario/submissoes-api';

/**
 * Abre a anamnese do aluno:
 *   GET  /alunos/:alunoId/anamnese/modelo   → modelo certo para o sexo do aluno (BE-QST-05)
 *   POST /alunos/:alunoId/submissoes        → abre o rascunho ou retoma o aberto (BE-RSP-02)
 * Autosave e envio usam as rotas comuns de questionario/submissoes-api.ts.
 */
export async function abrirAnamnese(quem: Identificacao): Promise<Submissao> {
  const modelo = await unwrap(
    api.GET('/alunos/{alunoId}/anamnese/modelo', { params: doAluno(quem) }),
  );
  return submissoesApi.abrir(quem, modelo.id);
}

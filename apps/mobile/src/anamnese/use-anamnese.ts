import { abrirAnamnese } from './anamnese-api';
import { useQuestionario } from '../questionario/use-questionario';

import type { OpcoesQuestionario, Questionario } from '../questionario/use-questionario';

/** O que é próprio da anamnese; o resto (autosave, envio, erros) é o motor de questionario/. */
const ANAMNESE: OpcoesQuestionario = {
  abrir: abrirAnamnese,
  // Mesmo nome de arquivo de antes: rascunhos já guardados no aparelho continuam valendo.
  chaveRascunho: ({ alunoId }) => `anamnese-rascunho-${alunoId}`,
  nome: 'a anamnese',
  // Mensagens do back escritas para o profissional ("crie um modelo…", "ative o modelo…").
  paraOAluno: {
    ANAMNESE_NAO_DISPONIVEL: 'Sua anamnese ainda não está disponível. Avise seu treinador.',
    MODELO_INATIVO: 'A anamnese está indisponível no momento. Fale com seu treinador.',
  },
};

/** MB-ANA-01 · Preenchimento da anamnese · MB-ANA-02 · Autosave de rascunho. */
export function useAnamnese(): Questionario {
  return useQuestionario(ANAMNESE);
}

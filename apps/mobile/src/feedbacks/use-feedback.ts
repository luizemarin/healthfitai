import { useCallback, useEffect, useState } from 'react';

import { idValido, PARA_O_ALUNO } from './feedback-formato';
import { feedbacksApi } from './feedbacks-api';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { Feedback } from './feedbacks-api';

export type FaseFeedback =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronto'; feedback: Feedback };

/** Link com id que não é de feedback (ex.: e-mail cortado): tentar de novo não resolve. */
const LINK_INVALIDO = {
  tipo: 'erro',
  mensagem: 'Este link de feedback não é válido. Abra o feedback pela lista do app.',
  podeTentarDeNovo: false,
} as const;

/**
 * Um feedback do aluno (status, datas e comentários do profissional). Vale para quem abre pela
 * lista e para quem chega pelo link do e-mail (healthfitai://feedbacks/<id>).
 */
export function useFeedback(id: unknown): { fase: FaseFeedback; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<FaseFeedback>(() => {
    if (!quem) {
      return SEM_CADASTRO;
    }
    return idValido(id) ? { tipo: 'carregando' } : LINK_INVALIDO;
  });

  useEffect(() => {
    if (!quem || !idValido(id)) {
      return undefined;
    }
    let ativo = true;

    feedbacksApi
      .buscar(quem, id)
      .then((feedback) => {
        if (ativo) {
          setFase({ tipo: 'pronto', feedback });
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error('[feedback] Falha ao abrir o feedback.', error);
        setFase({
          tipo: 'erro',
          // Ex.: "Feedback não encontrado." vem do back como está.
          mensagem: mensagemDoErro(
            error,
            'Pode ter sido uma falha momentânea. Tente de novo em instantes.',
            PARA_O_ALUNO,
          ),
          podeTentarDeNovo: true,
        });
      });

    return () => {
      ativo = false;
    };
  }, [id, quem, tentativa]);

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return { fase, recarregar };
}

import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { PARA_O_ALUNO, SECOES } from './feedback-formato';
import { feedbacksApi } from './feedbacks-api';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { FeedbackResumo, StatusFeedback } from './feedbacks-api';

/** Uma seção da lista (Pendentes, Atrasados, Respondidos). */
export interface Secao {
  status: StatusFeedback;
  itens: FeedbackResumo[];
  total: number;
  pagina: number;
  temMais: boolean;
  carregandoMais: boolean;
  /** Falha ao carregar a próxima página (a lista que já está na tela continua). */
  erroMais: string | null;
}

export type FaseLista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; secoes: Secao[] };

export interface ListaFeedbacks {
  fase: FaseLista;
  carregarMais: (status: StatusFeedback) => void;
  recarregar: () => void;
}

const FALHA_PADRAO = 'Pode ter sido uma falha momentânea. Tente de novo em instantes.';

/**
 * MB-FBK-01 · Lista de feedbacks e status: pendentes, atrasados e respondidos, cada um com a
 * primeira página e "Ver mais". Recarrega sempre que a tela volta ao foco (ex.: depois de
 * responder um feedback), sem tirar da tela a lista que já estava aberta.
 */
export function useFeedbacks(): ListaFeedbacks {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseLista>(() => (quem ? { tipo: 'carregando' } : SEM_CADASTRO));
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[feedbacks] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    Promise.all(SECOES.map(async ({ status }) => feedbacksApi.listar(quem, status, 1)))
      .then((paginas) => {
        if (minha !== carga.current) {
          return;
        }
        setFase({
          tipo: 'pronta',
          secoes: SECOES.map(({ status }, indice) => {
            const pagina = paginas[indice] ?? { itens: [], total: 0, temMais: false };
            return { status, ...pagina, pagina: 1, carregandoMais: false, erroMais: null };
          }),
        });
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        console.error('[feedbacks] Falha ao carregar a lista.', error);
        setFase((atual) =>
          // Já havia lista na tela (recarga ao voltar ao foco): mantém a que estava.
          atual.tipo === 'pronta'
            ? atual
            : {
                tipo: 'erro',
                mensagem: mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO),
                podeTentarDeNovo: true,
              },
        );
      });
  }, [quem]);

  useFocusEffect(carregar);

  /** Atualiza só a seção do status, se a lista ainda estiver na tela. */
  const mudarSecao = useCallback((status: StatusFeedback, mudar: (secao: Secao) => Secao): void => {
    setFase((atual) =>
      atual.tipo === 'pronta'
        ? {
            ...atual,
            secoes: atual.secoes.map((secao) => (secao.status === status ? mudar(secao) : secao)),
          }
        : atual,
    );
  }, []);

  const carregarMais = useCallback(
    (status: StatusFeedback): void => {
      const secao = fase.tipo === 'pronta' ? fase.secoes.find((s) => s.status === status) : null;
      if (!quem || !secao || secao.carregandoMais || !secao.temMais) {
        return;
      }
      const proxima = secao.pagina + 1;
      mudarSecao(status, (s) => ({ ...s, carregandoMais: true, erroMais: null }));

      feedbacksApi
        .listar(quem, status, proxima)
        .then(({ itens, total, temMais }) => {
          mudarSecao(status, (s) => ({
            ...s,
            // Sem repetir item que mudou de página enquanto o aluno rolava.
            itens: [...s.itens, ...itens.filter((novo) => !s.itens.some((i) => i.id === novo.id))],
            total,
            temMais,
            pagina: proxima,
            carregandoMais: false,
          }));
        })
        .catch((error: unknown) => {
          console.warn('[feedbacks] Falha ao carregar mais.', error);
          mudarSecao(status, (s) => ({
            ...s,
            carregandoMais: false,
            erroMais: mensagemDoErro(error, 'Não conseguimos carregar mais feedbacks agora.'),
          }));
        });
    },
    [fase, mudarSecao, quem],
  );

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    carregar();
  }, [carregar]);

  return { fase, carregarMais, recarregar };
}

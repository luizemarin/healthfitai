import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { treinosApi } from './treinos-api';
import { FALHA_PADRAO, PARA_O_ALUNO } from './treinos-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { EvolucaoTreino } from './treinos-api';

export type FaseEvolucaoTreino =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; evolucao: EvolucaoTreino };

/**
 * MB-EVO-03 · Frequência semanal e progressão de carga por exercício. Recarrega sempre que a tela
 * volta ao foco (ex.: depois de finalizar um treino). Se essa recarga falhar, os gráficos que já
 * estão na tela continuam.
 */
export function useEvolucaoTreino(): { fase: FaseEvolucaoTreino; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseEvolucaoTreino>(() =>
    quem ? { tipo: 'carregando' } : SEM_CADASTRO,
  );
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[evolucao-treino] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    treinosApi
      .evolucao(quem)
      .then((evolucao) => {
        if (minha === carga.current) {
          setFase({ tipo: 'pronta', evolucao });
        }
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        console.error('[evolucao-treino] Falha ao carregar a evolução do treino.', error);
        setFase((atual) =>
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

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    carregar();
  }, [carregar]);

  return { fase, recarregar };
}

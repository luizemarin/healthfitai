import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { treinosApi } from './treinos-api';
import { FALHA_PADRAO, PARA_O_ALUNO } from './treinos-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { Treino } from './treinos-api';

export type FaseTreinos =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; treinos: Treino[] };

/**
 * Treinos ativos do aluno, para escolher qual fazer. Recarrega sempre que a tela volta ao foco
 * (o treinador pode ter mudado algo). Se essa recarga falhar, a lista que está na tela continua.
 */
export function useTreinos(): { fase: FaseTreinos; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseTreinos>(() =>
    quem ? { tipo: 'carregando' } : SEM_CADASTRO,
  );
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[treinos] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    treinosApi
      .listar(quem)
      .then((treinos) => {
        if (minha === carga.current) {
          setFase({ tipo: 'pronta', treinos });
        }
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        console.error('[treinos] Falha ao carregar os treinos.', error);
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

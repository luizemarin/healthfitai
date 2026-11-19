import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { evolucaoApi } from './evolucao-api';
import { FALHA_PADRAO, PARA_O_ALUNO } from './evolucao-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { Evolucao } from './evolucao-api';

export type FaseEvolucao =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; evolucao: Evolucao };

/**
 * MB-EVO-02 · Séries dos gráficos de evolução: peso, medidas e perguntas flagadas.
 * Recarrega sempre que a tela volta ao foco (ex.: depois de registrar peso e medidas). Se essa
 * recarga falhar, os gráficos que já estão na tela continuam.
 */
export function useEvolucao(): { fase: FaseEvolucao; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseEvolucao>(() =>
    quem ? { tipo: 'carregando' } : SEM_CADASTRO,
  );
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[evolucao] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    evolucaoApi
      .buscar(quem)
      .then((evolucao) => {
        if (minha === carga.current) {
          setFase({ tipo: 'pronta', evolucao });
        }
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        console.error('[evolucao] Falha ao carregar a evolução.', error);
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

import { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { nutricaoApi } from './nutricao-api';
import { FALHA_PADRAO, SEM_PLANO } from './nutricao-formato';
import { ApiError } from '../api/api-error';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { PlanoNutricional } from './nutricao-api';

export type FasePlano =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'sem-plano' }
  | { tipo: 'pronta'; plano: PlanoNutricional };

/**
 * Plano nutricional em uso do aluno. Recarrega sempre que a tela volta ao foco (o treinador pode
 * ter trocado o plano). Se essa recarga falhar, o plano que está na tela continua.
 */
export function usePlano(): { fase: FasePlano; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FasePlano>(() => (quem ? { tipo: 'carregando' } : SEM_CADASTRO));
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[nutricao] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    nutricaoApi
      .buscarAtivo(quem)
      .then((plano) => {
        if (minha === carga.current) {
          setFase({ tipo: 'pronta', plano });
        }
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        // O treinador encerrou o plano (ou ainda não criou): mostra o estado vazio.
        if (error instanceof ApiError && error.code === SEM_PLANO) {
          setFase({ tipo: 'sem-plano' });
          return;
        }
        console.error('[nutricao] Falha ao carregar o plano nutricional.', error);
        setFase((atual) =>
          atual.tipo === 'pronta'
            ? atual
            : {
                tipo: 'erro',
                mensagem: mensagemDoErro(error, FALHA_PADRAO),
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

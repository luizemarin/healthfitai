import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { fotosApi } from './fotos-api';
import { FALHA_PADRAO, PARA_O_ALUNO } from './fotos-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { Comparacao, FotosDoDia } from './fotos-api';

export type FaseGaleria =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | {
      tipo: 'pronta';
      dias: FotosDoDia[];
      pagina: number;
      temMais: boolean;
      carregandoMais: boolean;
      /** Falha ao carregar a próxima página (a galeria que já está na tela continua). */
      erroMais: string | null;
    };

export interface Galeria {
  fase: FaseGaleria;
  carregarMais: () => void;
  recarregar: () => void;
}

/**
 * MB-FOT-02 · Galeria do aluno: fotos por data (mais recentes primeiro) e, no dia, pela pose.
 * Recarrega sempre que a tela volta ao foco (ex.: depois de enviar fotos), o que também renova
 * as URLs assinadas, que valem poucos minutos. Se essa recarga falhar, a galeria na tela continua.
 */
export function useGaleria(): Galeria {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseGaleria>(() =>
    quem ? { tipo: 'carregando' } : SEM_CADASTRO,
  );
  // Só a carga mais nova vale (ex.: voltou ao foco enquanto a anterior ainda vinha).
  const carga = useRef(0);

  const carregar = useCallback((): void => {
    if (!quem) {
      console.error(
        '[fotos] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return;
    }
    carga.current += 1;
    const minha = carga.current;

    fotosApi
      .galeria(quem, 1)
      .then(({ dias, temMais }) => {
        if (minha === carga.current) {
          setFase({
            tipo: 'pronta',
            dias,
            temMais,
            pagina: 1,
            carregandoMais: false,
            erroMais: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (minha !== carga.current) {
          return;
        }
        console.error('[fotos] Falha ao carregar a galeria.', error);
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

  const carregarMais = useCallback((): void => {
    if (!quem || fase.tipo !== 'pronta' || fase.carregandoMais || !fase.temMais) {
      return;
    }
    const proxima = fase.pagina + 1;
    const minha = carga.current;
    setFase({ ...fase, carregandoMais: true, erroMais: null });

    fotosApi
      .galeria(quem, proxima)
      .then(({ dias, temMais }) => {
        setFase((atual) =>
          atual.tipo === 'pronta' && minha === carga.current
            ? {
                ...atual,
                // Sem repetir dia que mudou de página enquanto o aluno rolava.
                dias: [
                  ...atual.dias,
                  ...dias.filter((d) => !atual.dias.some((a) => a.dataRegistro === d.dataRegistro)),
                ],
                temMais,
                pagina: proxima,
                carregandoMais: false,
              }
            : atual,
        );
      })
      .catch((error: unknown) => {
        console.warn('[fotos] Falha ao carregar mais fotos.', error);
        setFase((atual) =>
          atual.tipo === 'pronta'
            ? {
                ...atual,
                carregandoMais: false,
                erroMais: mensagemDoErro(error, 'Não conseguimos carregar mais fotos agora.'),
              }
            : atual,
        );
      });
  }, [fase, quem]);

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    carregar();
  }, [carregar]);

  return { fase, carregarMais, recarregar };
}

export type FaseComparacao =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronta'; comparacao: Comparacao };

/** MB-FOT-02 · Antes/depois: uma linha por pose com a foto de cada data. */
export function useComparacao(
  antes: string,
  depois: string,
): { fase: FaseComparacao; recarregar: () => void } {
  const [quem] = useState(identificacaoDoAluno);
  const [tentativa, setTentativa] = useState(0);
  // Resultado guardado com a busca que o gerou: trocou as datas (ou tentou de novo) → "carregando".
  const chave = `${antes}|${depois}|${String(tentativa)}`;
  const [resultado, setResultado] = useState<{ chave: string; fase: FaseComparacao } | null>(null);

  useEffect(() => {
    if (!quem) {
      return undefined;
    }
    let ativo = true;

    fotosApi
      .comparar(quem, { antes, depois })
      .then((comparacao) => {
        if (ativo) {
          setResultado({ chave, fase: { tipo: 'pronta', comparacao } });
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error('[fotos] Falha ao carregar a comparação.', error);
        // Ex.: "A data \"depois\" deve ser posterior à data \"antes\"." vem do back como está.
        setResultado({
          chave,
          fase: { tipo: 'erro', mensagem: mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO) },
        });
      });

    return () => {
      ativo = false;
    };
  }, [antes, chave, depois, quem]);

  const recarregar = useCallback((): void => {
    setTentativa((atual) => atual + 1);
  }, []);

  const fase: FaseComparacao = resultado?.chave === chave ? resultado.fase : { tipo: 'carregando' };
  return { fase, recarregar };
}

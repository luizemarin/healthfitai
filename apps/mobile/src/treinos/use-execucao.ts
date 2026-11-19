import { useCallback, useEffect, useState } from 'react';

import { segundosEntre } from './relogio';
import { treinosApi } from './treinos-api';
import {
  CARGA_INVALIDA,
  CONFIRA_AS_SERIES,
  FALHA_PADRAO,
  JA_REGISTRADO,
  lerRepeticoes,
  PARA_O_ALUNO,
  REPETICOES_INVALIDAS,
  SEM_SERIES,
} from './treinos-formato';
import { ApiError } from '../api/api-error';
import { lerNumero } from '../evolucao/evolucao-formato';
import { idValido } from '../feedbacks/feedback-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { ItemTreino, SerieFeita, Treino } from './treinos-api';

/** Descanso feito: até 30 minutos (limite do back). Se o aluno esquecer de encerrar, vale o máximo. */
const DESCANSO_MAXIMO_SEGUNDOS = 1800;

export type FaseExecucao =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; treino: Treino };

/** O que o aluno anotou numa série. Texto como foi digitado; vira número só ao conferir. */
export interface Serie {
  repeticoes: string;
  carga: string;
  concluida: boolean;
  /** Descanso feito DEPOIS desta série, em segundos. null = não medido. */
  descansoSegundos: number | null;
}

/** Descanso em andamento: começa ao concluir uma série (se o treinador pediu descanso). */
export interface Descanso {
  chave: string;
  inicio: number;
  prescritoSegundos: number;
}

export type Envio =
  | { tipo: 'ocioso' }
  | { tipo: 'enviando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'concluido'; detalhe: string };

type PorSerie<T> = Record<string, T | undefined>;

export const SERIE_VAZIA: Serie = {
  repeticoes: '',
  carga: '',
  concluida: false,
  descansoSegundos: null,
};

/** Uma série é o exercício + o número dela (1, 2, 3...), igual ao que a API recebe. */
export const chaveDaSerie = (exercicioId: string, numero: number): string =>
  `${exercicioId}#${String(numero)}`;

/** Id que não é UUID (ex.: link errado) nem vai à API. Mesmo texto do 404 do back. */
const NAO_ENCONTRADO = {
  tipo: 'erro',
  mensagem: 'Treino não encontrado.',
  podeTentarDeNovo: false,
} as const;

/** Confere o que foi digitado. Limites (repetições, carga, casas decimais) são do back. */
function conferir(serie: Serie): { repeticoes: number; cargaKg: number | null } | string {
  const repeticoes = lerRepeticoes(serie.repeticoes);
  if (repeticoes === null || Number.isNaN(repeticoes)) {
    return REPETICOES_INVALIDAS;
  }
  const cargaKg = lerNumero(serie.carga);
  if (cargaKg !== null && Number.isNaN(cargaKg)) {
    return CARGA_INVALIDA;
  }
  return { repeticoes, cargaKg };
}

const tempoDeDescanso = (descanso: Descanso, agora: number): number =>
  Math.min(segundosEntre(descanso.inicio, agora), DESCANSO_MAXIMO_SEGUNDOS);

/** Erros do back → série certa: body.series.<i>.* (i = posição na lista enviada). */
function errosDasSeries(error: unknown, enviadas: readonly string[]): PorSerie<string> {
  const erros: PorSerie<string> = {};
  if (!(error instanceof ApiError)) {
    return erros;
  }
  error.details.forEach(({ field, message }) => {
    const indice = /^body\.series\.(\d+)/.exec(field)?.[1];
    const chave = indice === undefined ? undefined : enviadas[Number(indice)];
    if (chave) {
      erros[chave] ??= message;
    }
  });
  return erros;
}

/**
 * Frase para o aluno quando o erro não é de uma série. Na validação, o detalhe do back explica
 * melhor que a frase geral (ex.: "O início do treino não pode ser no futuro. Confira a data e a
 * hora do celular.").
 */
function mensagemGeral(error: unknown): string {
  const detalhe = error instanceof ApiError ? error.details[0]?.message : undefined;
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && detalhe) {
    return detalhe;
  }
  return mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO);
}

export interface Execucao {
  fase: FaseExecucao;
  /** Início do treino (ms): quando o treino abriu na tela. */
  inicio: number | null;
  /** Fim (ms) ao tocar em "Finalizar treino". null = o timer está correndo. */
  fim: number | null;
  series: PorSerie<Serie>;
  erros: PorSerie<string>;
  descanso: Descanso | null;
  envio: Envio;
  alterar: (chave: string, campo: 'repeticoes' | 'carga', texto: string) => void;
  alternar: (item: ItemTreino, numero: number) => void;
  encerrarDescanso: () => void;
  finalizar: () => void;
  recarregar: () => void;
}

/**
 * MB-TRE-01 / MB-TRE-02 · Execução do treino: o timer começa quando o treino abre; o aluno anota
 * repetições e carga de cada série e marca como feita; o descanso começa sozinho e termina ao
 * encerrar ou ao concluir a próxima série. "Finalizar treino" envia tudo de uma vez (BE-TRE-02).
 *
 * Só as séries marcadas como feitas são enviadas. Se o envio falhar, nada sai da tela e o timer
 * volta a correr; reenviar usa o mesmo início, então o back não registra duas vezes.
 */
export function useExecucao(id: unknown): Execucao {
  const [quem] = useState(identificacaoDoAluno);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<FaseExecucao>(() => {
    if (!quem) {
      return SEM_CADASTRO;
    }
    return idValido(id) ? { tipo: 'carregando' } : NAO_ENCONTRADO;
  });
  const [inicio, setInicio] = useState<number | null>(null);
  const [fim, setFim] = useState<number | null>(null);
  const [series, setSeries] = useState<PorSerie<Serie>>({});
  const [erros, setErros] = useState<PorSerie<string>>({});
  const [descanso, setDescanso] = useState<Descanso | null>(null);
  const [envio, setEnvio] = useState<Envio>({ tipo: 'ocioso' });

  useEffect(() => {
    if (!quem) {
      console.error(
        '[treinos] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return undefined;
    }
    if (!idValido(id)) {
      return undefined;
    }
    let ativo = true;

    treinosApi
      .buscar(quem, id)
      .then((treino) => {
        if (ativo) {
          setFase({ tipo: 'pronta', treino });
          setInicio((atual) => atual ?? Date.now());
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error('[treinos] Falha ao carregar o treino.', error);
        setFase({
          tipo: 'erro',
          mensagem: mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO),
          podeTentarDeNovo: true,
        });
      });

    return () => {
      ativo = false;
    };
  }, [id, quem, tentativa]);

  const alterar = useCallback((chave: string, campo: 'repeticoes' | 'carga', texto: string) => {
    setSeries((atual) => ({
      ...atual,
      [chave]: { ...(atual[chave] ?? SERIE_VAZIA), [campo]: texto },
    }));
    // Mexeu na série: o erro dela e o aviso de antes já não valem.
    setErros((atual) => ({ ...atual, [chave]: undefined }));
    setEnvio((atual) => (atual.tipo === 'erro' ? { tipo: 'ocioso' } : atual));
  }, []);

  const alternar = useCallback(
    (item: ItemTreino, numero: number): void => {
      const chave = chaveDaSerie(item.exercicio.id, numero);
      const serie = series[chave] ?? SERIE_VAZIA;

      // Desmarcar: volta a ser uma série não feita (e para o descanso dela, se estiver correndo).
      if (serie.concluida) {
        setSeries((atual) => ({
          ...atual,
          [chave]: { ...serie, concluida: false, descansoSegundos: null },
        }));
        if (descanso?.chave === chave) {
          setDescanso(null);
        }
        return;
      }

      const conferida = conferir(serie);
      if (typeof conferida === 'string') {
        setErros((atual) => ({ ...atual, [chave]: conferida }));
        return;
      }

      // Concluir: encerra o descanso anterior (guardando o tempo nele) e começa o desta série.
      const agora = Date.now();
      setSeries((atual) => {
        const proximas = { ...atual, [chave]: { ...serie, concluida: true } };
        const anterior = descanso && proximas[descanso.chave];
        if (descanso && anterior) {
          proximas[descanso.chave] = {
            ...anterior,
            descansoSegundos: tempoDeDescanso(descanso, agora),
          };
        }
        return proximas;
      });
      setErros((atual) => ({ ...atual, [chave]: undefined }));
      setDescanso(
        item.descansoSegundos > 0
          ? { chave, inicio: agora, prescritoSegundos: item.descansoSegundos }
          : null,
      );
    },
    [descanso, series],
  );

  const encerrarDescanso = useCallback((): void => {
    if (!descanso) {
      return;
    }
    const agora = Date.now();
    setSeries((atual) => {
      const serie = atual[descanso.chave];
      return serie
        ? {
            ...atual,
            [descanso.chave]: { ...serie, descansoSegundos: tempoDeDescanso(descanso, agora) },
          }
        : atual;
    });
    setDescanso(null);
  }, [descanso]);

  const finalizar = useCallback((): void => {
    if (!quem || fase.tipo !== 'pronta' || inicio === null) {
      return;
    }
    if (envio.tipo === 'enviando' || envio.tipo === 'concluido') {
      return;
    }

    // 1) Junta as séries feitas, na ordem do treino, conferindo de novo (podem ter sido editadas).
    const enviadas: string[] = [];
    const feitas: SerieFeita[] = [];
    const errosLocais: PorSerie<string> = {};
    fase.treino.exercicios.forEach((item) => {
      for (let numero = 1; numero <= item.series; numero += 1) {
        const chave = chaveDaSerie(item.exercicio.id, numero);
        const serie = series[chave];
        if (serie?.concluida) {
          const conferida = conferir(serie);
          if (typeof conferida === 'string') {
            errosLocais[chave] = conferida;
          } else {
            enviadas.push(chave);
            feitas.push({
              exercicioId: item.exercicio.id,
              serie: numero,
              repeticoes: conferida.repeticoes,
              cargaKg: conferida.cargaKg,
              descansoSegundos: serie.descansoSegundos,
            });
          }
        }
      }
    });

    if (Object.keys(errosLocais).length > 0) {
      setErros(errosLocais);
      setEnvio({ tipo: 'erro', mensagem: CONFIRA_AS_SERIES });
      return;
    }
    if (feitas.length === 0) {
      setEnvio({ tipo: 'erro', mensagem: SEM_SERIES });
      return;
    }

    // 2) Para o timer e envia. Descanso em andamento no fim do treino não conta.
    const agora = Date.now();
    const duracaoSegundos = Math.max(1, segundosEntre(inicio, agora));
    setFim(agora);
    setDescanso(null);
    setErros({});
    setEnvio({ tipo: 'enviando' });

    treinosApi
      .finalizar(quem, fase.treino.id, {
        iniciadoEm: new Date(inicio).toISOString(),
        duracaoSegundos,
        series: feitas,
      })
      .then(() => {
        const total = feitas.length === 1 ? '1 série' : `${String(feitas.length)} séries`;
        setEnvio({ tipo: 'concluido', detalhe: `${total} registradas.` });
      })
      .catch((error: unknown) => {
        // Reenvio de um treino que já tinha chegado (ex.: a resposta se perdeu): está registrado.
        if (error instanceof ApiError && error.code === JA_REGISTRADO) {
          setEnvio({ tipo: 'concluido', detalhe: error.message });
          return;
        }
        console.error('[treinos] Falha ao finalizar o treino.', error);
        setFim(null); // o treino continua na tela; o timer volta a correr
        const errosApi = errosDasSeries(error, enviadas);
        setErros(errosApi);
        setEnvio({
          tipo: 'erro',
          mensagem: Object.keys(errosApi).length > 0 ? CONFIRA_AS_SERIES : mensagemGeral(error),
        });
      });
  }, [envio.tipo, fase, inicio, quem, series]);

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return {
    fase,
    inicio,
    fim,
    series,
    erros,
    descanso,
    envio,
    alterar,
    alternar,
    encerrarDescanso,
    finalizar,
    recarregar,
  };
}

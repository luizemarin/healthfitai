import { useCallback, useEffect, useState } from 'react';

import { evolucaoApi } from './evolucao-api';
import { FALHA_PADRAO, lerNumero, NUMERO_INVALIDO, PARA_O_ALUNO } from './evolucao-formato';
import { ApiError } from '../api/api-error';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { MedidaInformada, TipoMedida } from './evolucao-api';

/** Chave do campo de peso; os campos de medida usam o id do tipo. */
export const CAMPO_PESO = 'peso';

type PorCampo = Record<string, string | undefined>;

export type FaseRegistro =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; tipos: TipoMedida[] };

export type Aviso = { tipo: 'sucesso' | 'erro'; mensagem: string } | null;

export interface Registro {
  fase: FaseRegistro;
  valores: PorCampo;
  erros: PorCampo;
  aviso: Aviso;
  salvando: boolean;
  alterar: (campo: string, texto: string) => void;
  salvar: () => void;
  recarregar: () => void;
}

/** Erros do back → campo certo: body.pesoKg (peso) e body.medidas.<i>.* (i = posição enviada). */
function errosDosCampos(error: unknown, medidasEnviadas: MedidaInformada[]): PorCampo {
  const erros: PorCampo = {};
  if (!(error instanceof ApiError)) {
    return erros;
  }
  error.details.forEach(({ field, message }) => {
    const indice = /^body\.medidas\.(\d+)/.exec(field)?.[1];
    const campo =
      field === 'body.pesoKg'
        ? CAMPO_PESO
        : indice !== undefined && medidasEnviadas[Number(indice)]?.tipoId;
    if (campo) {
      erros[campo] ??= message;
    }
  });
  return erros;
}

/**
 * MB-EVO-01 · Registrar peso e medidas (formulário rápido): o peso e as medidas pedidas pelo
 * treinador, tudo com a data de hoje. Basta preencher o que mediu.
 *
 * Peso e medidas são rotas separadas no back. Se uma der certo e a outra não, o que foi salvo sai
 * da tela e só o que falhou fica para tentar de novo (nada é registrado duas vezes).
 */
export function useRegistro(): Registro {
  const [quem] = useState(identificacaoDoAluno);
  const [fase, setFase] = useState<FaseRegistro>(() =>
    quem ? { tipo: 'carregando' } : SEM_CADASTRO,
  );
  const [tentativa, setTentativa] = useState(0);
  const [valores, setValores] = useState<PorCampo>({});
  const [erros, setErros] = useState<PorCampo>({});
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!quem) {
      console.error(
        '[evolucao] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return undefined;
    }
    let ativo = true;

    evolucaoApi
      .tiposMedida(quem)
      .then((tipos) => {
        if (ativo) {
          setFase({ tipo: 'pronta', tipos });
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error('[evolucao] Falha ao carregar os tipos de medida.', error);
        setFase({
          tipo: 'erro',
          mensagem: mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO),
          podeTentarDeNovo: true,
        });
      });

    return () => {
      ativo = false;
    };
  }, [quem, tentativa]);

  const alterar = useCallback((campo: string, texto: string): void => {
    setValores((atual) => ({ ...atual, [campo]: texto }));
    // Mexeu no campo: o erro dele e o aviso de antes já não valem.
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    setAviso(null);
  }, []);

  const salvar = useCallback((): void => {
    if (!quem || fase.tipo !== 'pronta' || salvando) {
      return;
    }

    // 1) Confere o que foi digitado (o resto das regras — limites, casas decimais — é do back).
    const errosLocais: PorCampo = {};
    const peso = lerNumero(valores[CAMPO_PESO] ?? '');
    if (Number.isNaN(peso)) {
      errosLocais[CAMPO_PESO] = NUMERO_INVALIDO;
    }
    const medidas: MedidaInformada[] = [];
    fase.tipos.forEach((tipo) => {
      const valor = lerNumero(valores[tipo.id] ?? '');
      if (valor === null) {
        return;
      }
      if (Number.isNaN(valor)) {
        errosLocais[tipo.id] = NUMERO_INVALIDO;
      } else {
        medidas.push({ tipoId: tipo.id, valor });
      }
    });

    if (Object.keys(errosLocais).length > 0) {
      setErros(errosLocais);
      setAviso({ tipo: 'erro', mensagem: 'Confira os campos destacados.' });
      return;
    }
    if (peso === null && medidas.length === 0) {
      setAviso({ tipo: 'erro', mensagem: 'Preencha o peso ou pelo menos uma medida.' });
      return;
    }

    // 2) Envia peso e medidas juntos; cada um tem seu resultado.
    setSalvando(true);
    setErros({});
    setAviso(null);

    const envioPeso = peso === null ? null : evolucaoApi.registrarPeso(quem, peso);
    const envioMedidas = medidas.length === 0 ? null : evolucaoApi.registrarMedidas(quem, medidas);

    Promise.allSettled([envioPeso, envioMedidas])
      .then(([resultadoPeso, resultadoMedidas]) => {
        const pesoSalvo = envioPeso !== null && resultadoPeso.status === 'fulfilled';
        const medidasSalvas = envioMedidas !== null && resultadoMedidas.status === 'fulfilled';
        const falha = [resultadoPeso, resultadoMedidas].find(
          (resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected',
        );

        // O que foi salvo sai da tela: tentar de novo não registra duas vezes.
        setValores((atual) => {
          const restantes = { ...atual };
          if (pesoSalvo) {
            delete restantes[CAMPO_PESO];
          }
          if (medidasSalvas) {
            medidas.forEach(({ tipoId }) => delete restantes[tipoId]);
          }
          return restantes;
        });

        if (!falha) {
          let mensagem = 'Medidas registradas.';
          if (pesoSalvo) {
            mensagem = medidasSalvas ? 'Peso e medidas registrados.' : 'Peso registrado.';
          }
          setAviso({ tipo: 'sucesso', mensagem });
          return;
        }

        console.error('[evolucao] Falha ao registrar peso/medidas.', falha.reason);
        const errosApi = errosDosCampos(falha.reason, medidas);
        setErros(errosApi);

        let salvo = '';
        if (pesoSalvo) {
          salvo = 'O peso foi registrado. ';
        } else if (medidasSalvas) {
          salvo = 'As medidas foram registradas. ';
        }
        const motivo =
          Object.keys(errosApi).length > 0
            ? 'Confira os campos destacados.'
            : mensagemDoErro(falha.reason, FALHA_PADRAO, PARA_O_ALUNO);
        setAviso({ tipo: 'erro', mensagem: `${salvo}${motivo}` });
      })
      .finally(() => {
        setSalvando(false);
      });
  }, [fase, quem, salvando, valores]);

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return { fase, valores, erros, aviso, salvando, alterar, salvar, recarregar };
}

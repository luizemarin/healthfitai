import { useCallback, useEffect, useState } from 'react';

import { enviarFoto } from './enviar-foto';
import { escolherDaGaleria, tirarFoto } from './escolher-foto';
import { fotosApi } from './fotos-api';
import { FALHA_PADRAO, PARA_O_ALUNO, podeTentarDeNovo } from './fotos-formato';
import { mensagemDoErro } from '../questionario/erros';
import { identificacaoDoAluno } from '../questionario/submissoes-api';
import { SEM_CADASTRO } from '../questionario/use-questionario';

import type { ArquivoFoto, Escolha } from './escolher-foto';
import type { Foto, Pose } from './fotos-api';

/** Situação de cada pose na tela de envio. */
export type EstadoPose =
  | { tipo: 'vazia' }
  | { tipo: 'preparando' }
  | { tipo: 'enviando' }
  | { tipo: 'enviada'; foto: Foto }
  /** `arquivo`: a foto continua no aparelho para "Tentar de novo" sem tirar outra. */
  | { tipo: 'erro'; mensagem: string; arquivo: ArquivoFoto | null };

export type FaseEnvio =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'pronta'; poses: Pose[] };

/** Aviso de permissão da câmera. `abrirAjustes`: mostra o botão que abre os ajustes do app. */
export interface AvisoPermissao {
  abrirAjustes: boolean;
}

export interface EnvioFotos {
  fase: FaseEnvio;
  estados: Record<string, EstadoPose | undefined>;
  aviso: AvisoPermissao | null;
  tirar: (poseId: string) => void;
  escolher: (poseId: string) => void;
  tentarDeNovo: (poseId: string) => void;
  recarregar: () => void;
}

const FOTO_INDISPONIVEL = 'Não conseguimos usar esta foto. Tire outra ou escolha outra da galeria.';

/**
 * MB-FOT-01 · Envio de fotos por pose: carrega as poses pedidas pelo treinador (na ordem dele) e,
 * para cada uma, tira a foto ou escolhe da galeria e envia. Falhas passageiras são repetidas
 * sozinhas (enviar-foto.ts); se ainda falhar, a pose mostra o erro e "Tentar de novo".
 */
export function useEnvioFotos(): EnvioFotos {
  const [quem] = useState(identificacaoDoAluno);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<FaseEnvio>(() => (quem ? { tipo: 'carregando' } : SEM_CADASTRO));
  const [estados, setEstados] = useState<Record<string, EstadoPose | undefined>>({});
  const [aviso, setAviso] = useState<AvisoPermissao | null>(null);

  useEffect(() => {
    if (!quem) {
      console.error(
        '[fotos] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return undefined;
    }
    let ativo = true;

    fotosApi
      .poses(quem)
      .then((poses) => {
        if (ativo) {
          setFase({ tipo: 'pronta', poses });
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error('[fotos] Falha ao carregar as poses.', error);
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

  const mudar = useCallback((poseId: string, estado: EstadoPose): void => {
    setEstados((atual) => ({ ...atual, [poseId]: estado }));
  }, []);

  const enviar = useCallback(
    (poseId: string, arquivo: ArquivoFoto): void => {
      if (!quem) {
        return;
      }
      mudar(poseId, { tipo: 'enviando' });
      enviarFoto(quem, poseId, arquivo)
        .then((foto) => {
          mudar(poseId, { tipo: 'enviada', foto });
        })
        .catch((error: unknown) => {
          console.error('[fotos] Falha ao enviar a foto.', error);
          mudar(poseId, {
            tipo: 'erro',
            // Ex.: "A foto deve ter no máximo 10 MB." vem do back como está.
            mensagem: mensagemDoErro(error, FALHA_PADRAO, PARA_O_ALUNO),
            arquivo: podeTentarDeNovo(error) ? arquivo : null,
          });
        });
    },
    [mudar, quem],
  );

  /** Abre a câmera ou a galeria e, com a foto pronta, envia. */
  const obter = useCallback(
    (poseId: string, abrir: () => Promise<Escolha>): void => {
      const anterior = estados[poseId] ?? { tipo: 'vazia' };
      setAviso(null);
      mudar(poseId, { tipo: 'preparando' });

      abrir()
        .then((escolha) => {
          switch (escolha.tipo) {
            case 'pronta':
              enviar(poseId, escolha.arquivo);
              break;
            case 'cancelada':
              mudar(poseId, anterior); // desistiu: a pose fica como estava
              break;
            case 'sem-permissao':
              mudar(poseId, anterior);
              setAviso({ abrirAjustes: escolha.abrirAjustes });
              break;
            default:
              mudar(poseId, { tipo: 'erro', mensagem: FOTO_INDISPONIVEL, arquivo: null });
          }
        })
        .catch(() => {
          mudar(poseId, { tipo: 'erro', mensagem: FOTO_INDISPONIVEL, arquivo: null });
        });
    },
    [enviar, estados, mudar],
  );

  const tirar = useCallback((poseId: string) => obter(poseId, tirarFoto), [obter]);
  const escolher = useCallback((poseId: string) => obter(poseId, escolherDaGaleria), [obter]);

  const tentarDeNovo = useCallback(
    (poseId: string): void => {
      const estado = estados[poseId];
      if (estado?.tipo === 'erro' && estado.arquivo) {
        enviar(poseId, estado.arquivo);
      }
    },
    [enviar, estados],
  );

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return { fase, estados, aviso, tirar, escolher, tentarDeNovo, recarregar };
}

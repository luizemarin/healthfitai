import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState } from 'react-native';

import { errosPorPergunta, mensagemDoErro } from './erros';
import { rascunhoLocal } from './rascunho-local';
import { identificacaoDoAluno, submissoesApi } from './submissoes-api';
import { valorInicial, valorParaApi } from './valores';
import { ApiError } from '../api/api-error';

import type { ErrosPorPergunta, MensagensParaOAluno } from './erros';
import type {
  Identificacao,
  PerguntaRespondida,
  RespostaInformada,
  Submissao,
} from './submissoes-api';
import type { ValorCampo } from './valores';

/** Espera depois da última alteração antes de salvar no servidor (não salva a cada letra). */
const ESPERA_AUTOSAVE_MS = 1500;

export type Fase =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; podeTentarDeNovo: boolean }
  | { tipo: 'preenchendo'; submissao: Submissao }
  | { tipo: 'enviada' };

/** Situação do autosave, mostrada no topo do formulário. */
export type Salvamento =
  | { status: 'ocioso' }
  | { status: 'salvando' }
  | { status: 'salvo'; em: string }
  | { status: 'falhou'; mensagem: string };

type Valores = Record<string, ValorCampo>;

/** O que muda de um questionário para outro (anamnese, feedback). */
export interface OpcoesQuestionario {
  /** Abre o rascunho (ou retoma o aberto). */
  abrir: (quem: Identificacao) => Promise<Submissao>;
  /** Nome do arquivo do rascunho no aparelho (ex.: "anamnese-rascunho-<alunoId>"). */
  chaveRascunho: (quem: Identificacao) => string;
  /** Como o questionário aparece nas mensagens: "a anamnese", "o feedback". */
  nome: string;
  /** Frases para o aluno no lugar de mensagens do back, por código (ex.: MODELO_INATIVO). */
  paraOAluno?: MensagensParaOAluno;
  /** Só no feedback: qual feedback estas respostas respondem (o back muda o status dele). */
  feedbackId?: string;
}

/** O que a tela recebe do hook. */
export interface Questionario {
  fase: Fase;
  valores: Valores;
  erros: ErrosPorPergunta;
  salvamento: Salvamento;
  enviando: boolean;
  /** Mensagem do envio (ex.: obrigatórias pendentes), mostrada junto ao botão. */
  aviso: string | null;
  alterar: (perguntaId: string, valor: ValorCampo) => void;
  /** Salva já o que estiver pendente. Nunca rejeita: sem internet, fica no aparelho. */
  salvarAgora: () => Promise<void>;
  /** Devolve o id da primeira pergunta com problema, para a tela rolar até ela. */
  enviar: () => Promise<string | undefined>;
  recarregar: () => void;
}

/** Sem identificação do aluno (PROVISÓRIO, ver submissoes-api.ts) a tela já abre com este aviso. */
export const SEM_CADASTRO = {
  tipo: 'erro',
  mensagem: 'Não encontramos seu cadastro neste aparelho. Avise seu treinador.',
  podeTentarDeNovo: false,
} as const satisfies Fase;

/**
 * Estado que o autosave lê. Fica num ref (e não só no useState) para o salvamento sempre ver o
 * valor mais novo, mesmo rodando depois de várias alterações seguidas.
 */
interface Preenchimento {
  quem: Identificacao;
  chave: string;
  submissao: Submissao;
  valores: Valores;
  /** Perguntas alteradas que o servidor ainda não confirmou. */
  pendentes: Set<string>;
  erros: ErrosPorPergunta;
}

/** O que vai numa chamada: as respostas no formato da API e o valor da tela de cada uma. */
interface Lote {
  respostas: RespostaInformada[];
  valoresEnviados: Map<string, ValorCampo>;
  /** Problemas vistos antes de enviar (só data fora do formato DD/MM/AAAA). */
  erros: ErrosPorPergunta;
}

function montarLote(
  perguntas: readonly PerguntaRespondida[],
  ids: Iterable<string>,
  valores: Valores,
): Lote {
  const porId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
  const lote: Lote = { respostas: [], valoresEnviados: new Map(), erros: {} };

  [...ids].forEach((perguntaId) => {
    const pergunta = porId.get(perguntaId);
    if (!pergunta) {
      return;
    }
    const valor = valores[perguntaId] ?? null;
    const resultado = valorParaApi(pergunta, valor);
    if ('erro' in resultado) {
      lote.erros[perguntaId] = resultado.erro;
      return;
    }
    lote.respostas.push({ perguntaId, valor: resultado.valor });
    lote.valoresEnviados.set(perguntaId, valor);
  });
  return lote;
}

/** Primeira pergunta com erro, na ordem da tela (para rolar até ela). */
function primeiraComErro(
  perguntas: readonly PerguntaRespondida[],
  erros: ErrosPorPergunta,
): string | undefined {
  return perguntas.find((pergunta) => erros[pergunta.id])?.id;
}

/** Guarda no aparelho só o que o servidor ainda não confirmou; sem pendências, apaga. */
function guardarNoAparelho({ chave, submissao, valores, pendentes }: Preenchimento): void {
  if (pendentes.size === 0) {
    rascunhoLocal.apagar(chave);
    return;
  }
  rascunhoLocal.gravar(chave, {
    submissaoId: submissao.id,
    valores: Object.fromEntries([...pendentes].map((id) => [id, valores[id] ?? null])),
    pendentes: [...pendentes],
  });
}

/**
 * Preenchimento de um questionário pelo aluno, com autosave (regra criada em MB-ANA-01/02 e
 * usada também no feedback, MB-FBK-02).
 *
 *   Abrir   → abre o rascunho (ou retoma o aberto). O que ficou guardado no aparelho e não chegou
 *             ao servidor volta para a tela.
 *   Alterar → guarda no aparelho na hora e salva no servidor 1,5 s depois da última alteração.
 *             Também salva quando o app vai para segundo plano e ao sair da tela.
 *   Enviar  → manda o que faltava salvar e finaliza. Obrigatórias e formatos são conferidos pelo
 *             back; as mensagens dele aparecem embaixo de cada pergunta.
 */
export function useQuestionario(opcoes: OpcoesQuestionario): Questionario {
  // Lidas uma vez, ao montar: a tela de um questionário não troca de questionário.
  const [opcoesFixas] = useState(opcoes);

  const [quem] = useState(identificacaoDoAluno);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>(() => (quem ? { tipo: 'carregando' } : SEM_CADASTRO));
  const [valores, setValores] = useState<Valores>({});
  const [erros, setErros] = useState<ErrosPorPergunta>({});
  const [salvamento, setSalvamento] = useState<Salvamento>({ status: 'ocioso' });
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const preenchimento = useRef<Preenchimento | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Salvamentos em fila: um de cada vez, na ordem (nunca dois PATCH ao mesmo tempo).
  const fila = useRef<Promise<void>>(Promise.resolve());

  const mostrarErros = useCallback((novos: ErrosPorPergunta): void => {
    const atual = preenchimento.current;
    if (!atual) {
      return;
    }
    atual.erros = { ...atual.erros, ...novos };
    setErros(atual.erros);
  }, []);

  const pararTimer = useCallback((): void => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // ─── Abrir ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let ativo = true;
    preenchimento.current = null;

    if (!quem) {
      console.error(
        '[questionário] EXPO_PUBLIC_ALUNO_ID/EXPO_PUBLIC_PROFISSIONAL_ID não definidas (ver .env.example).',
      );
      return undefined;
    }

    const { abrir, chaveRascunho, nome, paraOAluno } = opcoesFixas;
    const chave = chaveRascunho(quem);

    abrir(quem)
      .then((submissao) => {
        if (!ativo) {
          return;
        }
        const iniciais: Valores = Object.fromEntries(
          submissao.perguntas.map((pergunta) => [pergunta.id, valorInicial(pergunta)]),
        );

        // Retoma o que ficou no aparelho e o servidor ainda não tinha recebido.
        const pendentes = new Set<string>();
        const local = rascunhoLocal.ler(chave);
        if (local?.submissaoId === submissao.id) {
          local.pendentes
            .filter((id) => id in iniciais)
            .forEach((id) => {
              iniciais[id] = local.valores[id] ?? null;
              pendentes.add(id);
            });
        }

        const atual: Preenchimento = {
          quem,
          chave,
          submissao,
          valores: iniciais,
          pendentes,
          erros: {},
        };
        preenchimento.current = atual;
        guardarNoAparelho(atual); // descarta cópia de um rascunho antigo, se houver
        setValores(iniciais);
        setErros({});
        setAviso(null);
        setSalvamento({ status: 'ocioso' });
        setFase({ tipo: 'preenchendo', submissao });
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        console.error(`[questionário] Falha ao abrir ${nome}.`, error);
        setFase({
          tipo: 'erro',
          mensagem: mensagemDoErro(
            error,
            'Pode ter sido uma falha momentânea. Tente de novo em instantes.',
            paraOAluno,
          ),
          podeTentarDeNovo: true,
        });
      });

    return () => {
      ativo = false;
    };
  }, [opcoesFixas, quem, tentativa]);

  // ─── Autosave ─────────────────────────────────────────────────────────────

  /** Manda ao servidor as perguntas pendentes. Nunca lança: o resultado vai para `salvamento`. */
  const enviarPendentes = useCallback(async (): Promise<void> => {
    const atual = preenchimento.current;
    if (!atual) {
      return;
    }

    // Pergunta com erro fica de fora até o aluno corrigir (senão o lote todo seria recusado).
    const ids = [...atual.pendentes].filter((id) => !atual.erros[id]);
    const lote = montarLote(atual.submissao.perguntas, ids, atual.valores);
    if (Object.keys(lote.erros).length > 0) {
      mostrarErros(lote.erros);
    }
    if (lote.respostas.length === 0) {
      return;
    }

    setSalvamento({ status: 'salvando' });
    try {
      const salva = await submissoesApi.salvarRascunho(
        atual.quem,
        atual.submissao.id,
        lote.respostas,
      );
      // Só deixa de ser pendente o que não mudou enquanto a requisição ia e voltava.
      lote.valoresEnviados.forEach((valor, perguntaId) => {
        if (atual.valores[perguntaId] === valor) {
          atual.pendentes.delete(perguntaId);
        }
      });
      guardarNoAparelho(atual);
      setSalvamento({ status: 'salvo', em: salva.atualizadoEm });
    } catch (error) {
      console.warn(
        '[questionário] Autosave falhou; as respostas seguem guardadas no aparelho.',
        error,
      );
      if (error instanceof ApiError && error.details.length > 0) {
        const ids = lote.respostas.map((resposta) => resposta.perguntaId);
        const novos = errosPorPergunta(error.details, ids);
        // Erro de um valor que o aluno já mudou não vale mais.
        Object.keys(novos).forEach((id) => {
          if (atual.valores[id] !== lote.valoresEnviados.get(id)) {
            delete novos[id];
          }
        });
        mostrarErros(novos);
      }
      setSalvamento({
        status: 'falhou',
        mensagem: mensagemDoErro(
          error,
          'Não conseguimos salvar suas respostas agora.',
          opcoesFixas.paraOAluno,
        ),
      });
    }
  }, [mostrarErros, opcoesFixas]);

  /** Salva já o que estiver pendente. Resolve quando terminar (sem lançar erro). */
  const salvarAgora = useCallback(async (): Promise<void> => {
    pararTimer();
    fila.current = fila.current.then(enviarPendentes);
    await fila.current;
  }, [enviarPendentes, pararTimer]);

  const agendarSalvamento = useCallback((): void => {
    pararTimer();
    timer.current = setTimeout(() => {
      salvarAgora().catch(() => {});
    }, ESPERA_AUTOSAVE_MS);
  }, [pararTimer, salvarAgora]);

  useEffect(() => {
    // iOS passa por "inactive" antes de "background"; Android vai direto para "background".
    // Qualquer saída de "active" salva, para os dois se comportarem igual.
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        salvarAgora().catch(() => {});
      }
    });
    return () => {
      assinatura.remove();
      salvarAgora().catch(() => {}); // saiu da tela: salva o que faltou
    };
  }, [salvarAgora]);

  // ─── Ações da tela ────────────────────────────────────────────────────────

  const alterar = useCallback(
    (perguntaId: string, valor: ValorCampo): void => {
      const atual = preenchimento.current;
      if (!atual) {
        return;
      }
      atual.valores = { ...atual.valores, [perguntaId]: valor };
      atual.pendentes.add(perguntaId);
      setValores(atual.valores);
      if (atual.erros[perguntaId]) {
        atual.erros = { ...atual.erros, [perguntaId]: undefined };
        setErros(atual.erros);
      }
      guardarNoAparelho(atual);
      agendarSalvamento();
    },
    [agendarSalvamento],
  );

  /**
   * Envia as respostas. Devolve o id da primeira pergunta com problema (para a tela rolar até
   * ela) ou undefined.
   */
  const enviar = useCallback(async (): Promise<string | undefined> => {
    const atual = preenchimento.current;
    if (!atual) {
      return undefined;
    }

    setEnviando(true);
    setAviso(null);
    pararTimer();
    await fila.current; // termina o autosave em andamento antes de enviar

    const { perguntas } = atual.submissao;
    const lote = montarLote(perguntas, atual.pendentes, atual.valores);
    if (Object.keys(lote.erros).length > 0) {
      mostrarErros(lote.erros);
      setAviso('Revise as respostas destacadas antes de enviar.');
      setEnviando(false);
      return primeiraComErro(perguntas, atual.erros);
    }

    try {
      await submissoesApi.finalizar(
        atual.quem,
        atual.submissao.id,
        lote.respostas,
        opcoesFixas.feedbackId,
      );
      atual.pendentes.clear();
      guardarNoAparelho(atual); // nada pendente: apaga a cópia do aparelho
      preenchimento.current = null;
      setFase({ tipo: 'enviada' });
      return undefined;
    } catch (error) {
      console.warn('[questionário] Falha ao enviar.', error);
      const novos =
        error instanceof ApiError
          ? errosPorPergunta(
              error.details,
              lote.respostas.map((resposta) => resposta.perguntaId),
            )
          : {};
      mostrarErros(novos);
      const { nome, paraOAluno } = opcoesFixas;
      // Ex.: "Responda as perguntas obrigatórias antes de enviar (2 pendente(s))."
      setAviso(
        mensagemDoErro(
          error,
          `Não foi possível enviar ${nome} agora. Suas respostas continuam salvas; tente de novo em instantes.`,
          paraOAluno,
        ),
      );
      return primeiraComErro(perguntas, novos);
    } finally {
      setEnviando(false);
    }
  }, [mostrarErros, opcoesFixas, pararTimer]);

  const recarregar = useCallback((): void => {
    setFase({ tipo: 'carregando' });
    setTentativa((atual) => atual + 1);
  }, []);

  return {
    fase,
    valores,
    erros,
    salvamento,
    enviando,
    aviso,
    alterar,
    salvarAgora,
    enviar,
    recarregar,
  };
}

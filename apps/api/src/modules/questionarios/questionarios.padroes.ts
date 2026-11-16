import type { NovaPergunta, TipoModelo } from './questionarios.repository';
import type { Sexo } from '../alunos/alunos.repository';

/**
 * Modelos padrão do sistema (profissionalId null = sem dono, só leitura).
 *   BE-QST-05 · Anamnese masculina e feminina
 *   BE-QST-06 · Avaliação físico-postural (preenchida pelo profissional)
 *
 * Mesmo conteúdo e mesmos ids FIXOS do seed do banco
 * (prisma/seeds/0021_modelos_e_poses_padrao/seed.sql). Id fixo porque o padrão
 * precisa ser o mesmo em todo ambiente (local, homologação, produção) e o seed
 * é idempotente por ele. Os ids das perguntas não são fixos: o banco gera
 * (gen_random_uuid()) e o repositório em memória também.
 *
 * Hoje este arquivo abastece o repositório em memória. Com o Prisma, quem
 * cria os padrões é o seed SQL; se mudar algo aqui, mude lá também.
 */

export interface ModeloPadrao {
  id: string;
  tipo: TipoModelo;
  nome: string;
  sexoAlvo: Sexo | null;
  perguntas: NovaPergunta[];
}

export const ID_ANAMNESE_MASCULINA = '00000000-0000-4000-a000-000000000001';
export const ID_ANAMNESE_FEMININA = '00000000-0000-4000-a000-000000000002';
export const ID_AVALIACAO_POSTURAL = '00000000-0000-4000-a000-000000000003';

// ─── Atalhos para montar perguntas (a ordem é a posição na lista) ───────────

type PerguntaSemOrdem = Omit<NovaPergunta, 'ordem'>;

const VAZIO = { exibirEvolucao: false, opcoes: null, unidade: null, min: null, max: null };

function escolhaUnica(enunciado: string, opcoes: string[], obrigatoria = true): PerguntaSemOrdem {
  return { ...VAZIO, tipo: 'escolha_unica', enunciado, obrigatoria, opcoes };
}

function multiplaEscolha(
  enunciado: string,
  opcoes: string[],
  obrigatoria = true,
): PerguntaSemOrdem {
  return { ...VAZIO, tipo: 'multipla_escolha', enunciado, obrigatoria, opcoes };
}

function textoLongo(enunciado: string, obrigatoria = false): PerguntaSemOrdem {
  return { ...VAZIO, tipo: 'texto_longo', enunciado, obrigatoria };
}

function numero(
  enunciado: string,
  limites: { unidade: string; min: number; max: number },
  extras: { obrigatoria: boolean; exibirEvolucao?: boolean },
): PerguntaSemOrdem {
  return {
    ...VAZIO,
    tipo: 'numero',
    enunciado,
    ...limites,
    obrigatoria: extras.obrigatoria,
    exibirEvolucao: extras.exibirEvolucao ?? false,
  };
}

function escala(enunciado: string, min: number, max: number): PerguntaSemOrdem {
  return {
    ...VAZIO,
    tipo: 'escala',
    enunciado,
    obrigatoria: false,
    exibirEvolucao: true,
    min,
    max,
  };
}

function emOrdem(perguntas: PerguntaSemOrdem[]): NovaPergunta[] {
  return perguntas.map((pergunta, indice) => ({ ordem: indice + 1, ...pergunta }));
}

// ─── BE-QST-05 · Anamnese ───────────────────────────────────────────────────

/** Perguntas comuns às duas anamneses (1 a 15). */
const ANAMNESE_COMUM: PerguntaSemOrdem[] = [
  escolhaUnica('Qual é o seu principal objetivo?', [
    'Emagrecimento',
    'Ganho de massa muscular',
    'Condicionamento',
    'Saúde e qualidade de vida',
    'Reabilitação',
    'Performance esportiva',
  ]),
  numero(
    'Peso atual',
    { unidade: 'kg', min: 20, max: 400 },
    { obrigatoria: true, exibirEvolucao: true },
  ),
  numero('Altura', { unidade: 'cm', min: 50, max: 250 }, { obrigatoria: true }),
  escolhaUnica('Pratica atividade física atualmente?', ['Sim', 'Não']),
  numero(
    'Quantos dias por semana você pode treinar?',
    { unidade: 'dias', min: 1, max: 7 },
    { obrigatoria: true },
  ),
  multiplaEscolha('Tem alguma destas condições de saúde?', [
    'Hipertensão',
    'Diabetes',
    'Doença cardíaca',
    'Asma',
    'Colesterol alto',
    'Nenhuma',
    'Outra',
  ]),
  textoLongo('Usa algum medicamento de forma contínua? Qual?'),
  textoLongo('Já teve lesões ou cirurgias? Quais e quando?'),
  multiplaEscolha('Sente dor em alguma destas regiões?', [
    'Cervical',
    'Ombro',
    'Lombar',
    'Quadril',
    'Joelho',
    'Tornozelo',
    'Nenhuma',
  ]),
  numero(
    'Quantas horas dorme por noite, em média?',
    { unidade: 'h', min: 0, max: 24 },
    { obrigatoria: false },
  ),
  escala('Como avalia a qualidade do seu sono?', 1, 5),
  escala('Como avalia o seu nível de estresse?', 1, 10),
  escolhaUnica('É fumante?', ['Sim', 'Não', 'Ex-fumante']),
  escolhaUnica('Consome bebida alcoólica?', ['Não', 'Socialmente', 'Semanalmente', 'Diariamente']),
  textoLongo('Algo mais que o seu profissional deva saber?'),
];

/** Extras só da anamnese feminina (16 a 19). */
const ANAMNESE_EXTRAS_FEMININA: PerguntaSemOrdem[] = [
  escolhaUnica('O seu ciclo menstrual é regular?', ['Sim', 'Não', 'Não se aplica']),
  escolhaUnica('Usa anticoncepcional ou terapia hormonal?', ['Sim', 'Não']),
  escolhaUnica('Está gestante ou teve gestação nos últimos 12 meses?', ['Sim', 'Não']),
  escolhaUnica('Está na menopausa?', ['Sim', 'Não', 'Não sei']),
];

// ─── BE-QST-06 · Avaliação físico-postural (5 testes) ───────────────────────

const COMPENSACOES_SINGLE_LEG = [
  'Valgo dinâmico do joelho',
  'Queda da pelve',
  'Rotação do tronco',
  'Inclinação do tronco',
  'Perda de equilíbrio',
  'Sem compensações',
];

const AVALIACAO_POSTURAL: PerguntaSemOrdem[] = [
  // 1 · Avaliação Postural Estática
  multiplaEscolha('Postural estática · vista anterior', [
    'Ombros desnivelados',
    'Pelve desnivelada',
    'Joelhos valgos',
    'Joelhos varos',
    'Pés pronados',
    'Pés supinados',
    'Sem alterações',
  ]),
  multiplaEscolha('Postural estática · vista lateral', [
    'Cabeça anteriorizada',
    'Ombros protusos',
    'Hipercifose torácica',
    'Hiperlordose lombar',
    'Retificação lombar',
    'Joelhos hiperestendidos',
    'Sem alterações',
  ]),
  multiplaEscolha('Postural estática · vista posterior', [
    'Escápulas aladas',
    'Escoliose aparente',
    'Calcâneos valgos',
    'Calcâneos varos',
    'Sem alterações',
  ]),
  // 2 · Trendelenburg
  escolhaUnica('Trendelenburg · apoio na perna direita', ['Negativo', 'Positivo']),
  escolhaUnica('Trendelenburg · apoio na perna esquerda', ['Negativo', 'Positivo']),
  // 3 · Single Leg Squat
  multiplaEscolha('Single Leg Squat · perna direita', COMPENSACOES_SINGLE_LEG),
  multiplaEscolha('Single Leg Squat · perna esquerda', COMPENSACOES_SINGLE_LEG),
  // 4 · Wall Angel
  escolhaUnica('Wall Angel · resultado', [
    'Completa sem compensações',
    'Completa com compensações',
    'Não completa',
  ]),
  multiplaEscolha('Wall Angel · compensações', [
    'Punhos/cotovelos perdem contato com a parede',
    'Hiperlordose lombar',
    'Cabeça anteriorizada',
    'Elevação dos ombros',
    'Sem compensações',
  ]),
  // 5 · OHSA (Overhead Squat Assessment)
  multiplaEscolha('OHSA · vista anterior', [
    'Pés rodam para fora',
    'Joelhos em valgo',
    'Joelhos em varo',
    'Transferência de peso assimétrica',
    'Sem compensações',
  ]),
  multiplaEscolha('OHSA · vista lateral', [
    'Inclinação excessiva do tronco',
    'Hiperlordose lombar',
    'Braços caem à frente',
    'Calcanhares saem do chão',
    'Sem compensações',
  ]),
  // Fechamento
  textoLongo('Observações gerais da avaliação'),
];

export const MODELOS_PADRAO: readonly ModeloPadrao[] = [
  {
    id: ID_ANAMNESE_MASCULINA,
    tipo: 'anamnese',
    nome: 'Anamnese masculina',
    sexoAlvo: 'masculino',
    perguntas: emOrdem(ANAMNESE_COMUM),
  },
  {
    id: ID_ANAMNESE_FEMININA,
    tipo: 'anamnese',
    nome: 'Anamnese feminina',
    sexoAlvo: 'feminino',
    perguntas: emOrdem([...ANAMNESE_COMUM, ...ANAMNESE_EXTRAS_FEMININA]),
  },
  {
    id: ID_AVALIACAO_POSTURAL,
    tipo: 'avaliacao',
    nome: 'Avaliação postural',
    sexoAlvo: null,
    perguntas: emOrdem(AVALIACAO_POSTURAL),
  },
];

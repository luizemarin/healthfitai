/**
 * Datas do painel (BE-DSH-01). Tudo em dias AAAA-MM-DD no horário de Brasília,
 * igual à evolução: um treino às 23h de domingo conta no domingo, não na segunda.
 * Datas AAAA-MM-DD comparam corretamente como texto.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Sem filtro de período, o painel mostra os últimos 30 dias (hoje incluído). */
export const DIAS_PERIODO_PADRAO = 30;

/** Período máximo aceito: um ano (com folga para o bissexto). */
export const DIAS_PERIODO_MAXIMO = 366;

/** Dia (AAAA-MM-DD) de um instante no horário de Brasília. */
export function diaEmBrasilia(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(momento);
}

export function hojeEmBrasilia(): string {
  return diaEmBrasilia(new Date());
}

/** Meia-noite UTC do dia: só para fazer conta de dias, sem efeito de fuso. */
function emMs(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

/** somarDias('2026-11-30', 1) = '2026-12-01'. Aceita dias negativos. */
export function somarDias(dia: string, dias: number): string {
  return new Date(emMs(dia) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** diasEntre('2026-11-01', '2026-11-03') = 2. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((emMs(ate) - emMs(de)) / MS_POR_DIA);
}

/** Segunda-feira da semana do dia (semana de segunda a domingo). */
export function inicioDaSemana(dia: string): string {
  const diaDaSemana = new Date(emMs(dia)).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((diaDaSemana + 6) % 7));
}

import { ApiError } from '../../api/api-error';

import type { FiltroPeriodo } from './dashboard-api';

/** Textos e formatos de exibição do painel (pt-BR). */

const numero = (valor: number, casas = 1): string =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

/** 2.8 → "2,8". */
export const formatarMedia = (valor: number): string => numero(valor);

/** 42.5 → "42,5 kg". */
export const formatarKg = (valor: number): string => `${numero(valor, 2)} kg`;

/** Variação com sinal: "+10 kg (+33,3%)", "-2,5 kg (-5%)", "0 kg". */
export function formatarVariacao(kg: number, percentual: number | null): string {
  const sinal = (valor: number): string => (valor > 0 ? '+' : '');
  const texto = `${sinal(kg)}${formatarKg(kg)}`;
  return percentual === null ? texto : `${texto} (${sinal(percentual)}${numero(percentual)}%)`;
}

/** Início do último treino em data do navegador: "14/11/2026". */
export const formatarDia = (iso: string): string => new Date(iso).toLocaleDateString('pt-BR');

/** Dias sem treinar, como o back calcula (0 = treinou hoje; null = nunca treinou). */
export function textoDiasSemTreinar(dias: number | null): string {
  if (dias === null) return 'Nunca treinou';
  if (dias === 0) return 'Treinou hoje';
  return dias === 1 ? '1 dia sem treinar' : `${String(dias)} dias sem treinar`;
}

/** Lê o período da URL (?de=AAAA-MM-DD&ate=AAAA-MM-DD). */
export function lerPeriodo(params: URLSearchParams): FiltroPeriodo {
  return { de: params.get('de') || undefined, ate: params.get('ate') || undefined };
}

/** Período como query string, para levar o mesmo período da lista para o detalhe e de volta. */
export function periodoNaUrl({ de, ate }: FiltroPeriodo): string {
  const params = new URLSearchParams();
  if (de) params.set('de', de);
  if (ate) params.set('ate', ate);
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Erros do back no período (400 VALIDATION_ERROR com details em `query.de` / `query.ate`):
 * vão para embaixo do campo certo, com a mensagem do back.
 */
export function errosDoPeriodo(error: unknown): { de?: string; ate?: string } {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const erros: { de?: string; ate?: string } = {};
  error.details.forEach(({ field, message }) => {
    if (field === 'query.de') erros.de ??= message;
    if (field === 'query.ate') erros.ate ??= message;
  });
  return erros;
}

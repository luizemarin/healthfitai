/**
 * Datas e horas no horário do aparelho, montadas à mão (sem `Intl`/`toLocaleString`), para saírem
 * iguais no iOS e no Android. Data inválida vira ''.
 */
const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');

function paraData(iso: string): Date | null {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "HH:MM" */
export function hora(iso: string): string {
  const data = paraData(iso);
  return data ? `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}` : '';
}

/** "DD/MM/AAAA" */
export function dataCurta(iso: string): string {
  const data = paraData(iso);
  return data
    ? `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${String(data.getFullYear())}`
    : '';
}

/**
 * "AAAA-MM-DD" (dia sem hora, ex.: data da foto) → "DD/MM/AAAA".
 * Não passa por `Date`: `new Date('2026-11-06')` é meia-noite UTC e, no Brasil, viraria 05/11.
 */
export function dataDoDia(aaaaMmDd: string): string {
  const [ano, mes, dia] = aaaaMmDd.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
}

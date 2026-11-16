/**
 * Data da avaliação (BE-RSP-03). O profissional escolhe só o dia; a API pede data e hora com fuso.
 *   hoje            → agora (o registro fica com a hora real)
 *   dia anterior    → meio-dia daquele dia no fuso do navegador (não vira outro dia em nenhum fuso)
 */

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');

/** Hoje em AAAA-MM-DD no fuso do navegador (é o dia em que o profissional está). */
export function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

export function dataParaApi(dia: string): string {
  return dia === hojeLocal() ? new Date().toISOString() : new Date(`${dia}T12:00:00`).toISOString();
}

/** Mesmas regras e mensagens do back; `undefined` = data válida. */
export function validarDataAvaliacao(dia: string): string | undefined {
  if (!dia) return 'Informe a data da avaliação.';
  if (dia > hojeLocal()) return 'A data da avaliação não pode estar no futuro.';
  return undefined;
}

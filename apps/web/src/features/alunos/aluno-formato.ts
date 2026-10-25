import type { Sexo } from './alunos-api';

/** Textos e formatos de exibição do aluno (pt-BR). */

export const SEXO_LABEL: Record<Sexo, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
};

/** "2008-05-17" → "17/05/2008" (sem fuso: é só uma data). */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia ?? ''}/${mes ?? ''}/${ano ?? ''}`;
}

/** Data e hora no fuso do navegador: "24/10/2026 15:38". */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** "11987654321" → "(11) 98765-4321"; "1133334444" → "(11) 3333-4444". */
export function formatarTelefone(digitos: string): string {
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return match ? `(${match[1] ?? ''}) ${match[2] ?? ''}-${match[3] ?? ''}` : digitos;
}

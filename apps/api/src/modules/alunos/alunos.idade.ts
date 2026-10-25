/**
 * Idade em anos completos a partir da data de nascimento (AAAA-MM-DD).
 * Usa a data em UTC, igual à validação da data de nascimento (alunos.schemas.ts).
 * Quem nasceu em 29/02 faz aniversário em 01/03 nos anos não bissextos.
 */
export function calcularIdade(dataNascimento: string, hoje: Date = new Date()): number {
  const ano = Number(dataNascimento.slice(0, 4));
  const mes = Number(dataNascimento.slice(5, 7));
  const dia = Number(dataNascimento.slice(8, 10));

  const mesAtual = hoje.getUTCMonth() + 1;
  const diaAtual = hoje.getUTCDate();
  const jaFezAniversario = mesAtual > mes || (mesAtual === mes && diaAtual >= dia);

  return hoje.getUTCFullYear() - ano - (jaFezAniversario ? 0 : 1);
}

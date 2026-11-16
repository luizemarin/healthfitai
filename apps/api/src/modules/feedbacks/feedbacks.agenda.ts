import { MAX_LEMBRETE_DIAS } from './feedbacks.schemas';

import type { Recorrencia } from './feedbacks.repository';

/**
 * Regras de data dos feedbacks, sem banco nem HTTP (testes: QA-UNI-01).
 *   BE-FBK-01 · próxima liberação de cada recorrência
 *   BE-FBK-03 · quando sai o lembrete e qual o maior prazo permitido
 *
 * Calendário no horário de Brasília (UTC−3 o ano todo; não há horário de
 * verão desde 2019). Importa na recorrência mensal: "todo dia 10" é dia 10 no
 * Brasil, mesmo que em UTC já seja dia 11.
 */

const FUSO_BRASILIA_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Maior dia aceito na recorrência mensal. Todo mês tem dia 28; com 29, 30 ou
 * 31 o sistema teria de "pular" para o fim do mês e a data ficaria mudando.
 */
export const ULTIMO_DIA_MENSAL = 28;

/** Intervalo em dias entre liberações (mensal: o menor mês, fevereiro). */
const INTERVALO_DIAS: Record<Recorrencia, number | null> = {
  semanal: 7,
  quinzenal: 14,
  mensal: 28,
  avulso: null,
};

/** Data/hora "de parede" em Brasília, lida com os getters UTC. */
function emBrasilia(data: Date): Date {
  return new Date(data.getTime() + FUSO_BRASILIA_MS);
}

/** Dia do mês (1–31) no horário de Brasília. */
export function diaDoMesEmBrasilia(data: Date): number {
  return emBrasilia(data).getUTCDate();
}

function somarMeses(data: Date, meses: number): Date {
  const local = emBrasilia(data);
  const ano = local.getUTCFullYear();
  const mes = local.getUTCMonth() + meses;
  // Dia 0 do mês seguinte = último dia do mês desejado.
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(local.getUTCDate(), ultimoDia);

  const resultadoLocal = Date.UTC(
    ano,
    mes,
    dia,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(resultadoLocal - FUSO_BRASILIA_MS);
}

/**
 * BE-FBK-01 · Próxima liberação depois de `atual`, no mesmo horário.
 *   semanal +7 dias · quinzenal +14 dias · mensal mesmo dia do mês seguinte
 *   avulso → null (liberado uma vez só; o agendamento é desativado depois do envio)
 * Usada pelo job de liberação (BE-FBK-02).
 */
export function calcularProximaLiberacao(recorrencia: Recorrencia, atual: Date): Date | null {
  switch (recorrencia) {
    case 'semanal':
      return new Date(atual.getTime() + 7 * DIA_MS);
    case 'quinzenal':
      return new Date(atual.getTime() + 14 * DIA_MS);
    case 'mensal':
      return somarMeses(atual, 1);
    case 'avulso':
      return null;
    default:
      throw new Error(`Recorrência desconhecida: ${String(recorrencia)}`);
  }
}

/**
 * BE-FBK-03 · Maior lembrete permitido: precisa sair antes do próximo
 * feedback (senão o aluno recebe o lembrete de um feedback já substituído).
 */
export function maxLembreteDias(recorrencia: Recorrencia): number {
  const intervalo = INTERVALO_DIAS[recorrencia];
  return intervalo === null ? MAX_LEMBRETE_DIAS : Math.min(intervalo - 1, MAX_LEMBRETE_DIAS);
}

/** BE-FBK-03 · Quando o lembrete sai, se o aluno não responder antes. */
export function dataDoLembrete(enviadoEm: Date, lembreteDias: number): Date {
  return new Date(enviadoEm.getTime() + lembreteDias * DIA_MS);
}

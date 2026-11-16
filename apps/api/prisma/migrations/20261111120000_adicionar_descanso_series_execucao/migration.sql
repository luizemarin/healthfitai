-- BE-TRE-02 · Descanso feito entre as séries (complementa o DB-024).
--
-- O requisito pede "tempos de descanso" na execução. O DB-024 guardava só o
-- descanso PRESCRITO (treino_exercicios.descanso_segundos); faltava o que o
-- aluno descansou de verdade. Esta migration acrescenta isso em cada série:
--
--   series_execucao.descanso_segundos = descanso feito DEPOIS desta série
--
-- NULL = não medido (ex.: última série do exercício, ou aluno pulou o timer).
-- Coluna nova e opcional: as linhas que já existem continuam válidas.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- AlterTable
ALTER TABLE "series_execucao" ADD COLUMN "descanso_segundos" INTEGER;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- descanso nunca negativo.
ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_descanso_nao_negativo_chk"
    CHECK ("descanso_segundos" IS NULL OR "descanso_segundos" >= 0);

COMMIT;

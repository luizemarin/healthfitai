-- DB-024 · Rollback: desfaz a migration 20261026210000_criar_execucoes_treino.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026210000_criar_execucoes_treino
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026210000_criar_execucoes_treino/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro as séries (dependem da execução), depois
-- as execuções. Tudo numa transação: se um DROP falhar, nada é apagado pela
-- metade.
--
-- ATENÇÃO: apaga o histórico de treinos feitos. Uso pensado para o banco
-- local/dev. Índices, FKs e CHECKs caem junto. As tabelas alunos, treinos e
-- exercicios não são tocadas.

BEGIN;

DROP TABLE IF EXISTS "series_execucao";
DROP TABLE IF EXISTS "execucoes_treino";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026210000_criar_execucoes_treino';

COMMIT;

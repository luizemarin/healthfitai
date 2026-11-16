-- DB-022 · Rollback: desfaz a migration 20261026190000_criar_exercicios.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026190000_criar_exercicios
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026190000_criar_exercicios/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-023 (treinos) ou o DB-024 (execuções) já foram aplicados,
-- rode o down.sql deles antes (o comando acima já faz isso). Sem isso, o DROP
-- abaixo falha de propósito (eles dependem desta tabela) e a transação
-- inteira é desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FK e CHECKs caem junto com a tabela. A tabela profissionais
-- (DB-003) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "exercicios";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026190000_criar_exercicios';

COMMIT;

-- DB-016 · Rollback: desfaz a migration 20261026140000_criar_registros_peso.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026140000_criar_registros_peso
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026140000_criar_registros_peso/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os registros de peso. Uso pensado para o banco local/dev.
-- Índice, FK e CHECK caem junto com a tabela. A tabela alunos (DB-004) e o
-- tipo "papel" (DB-001) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "registros_peso";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026140000_criar_registros_peso';

COMMIT;

-- DB-005 · Rollback: desfaz a migration 20261022120000_criar_convites.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261022120000_criar_convites/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FK e CHECKs caem junto com a tabela. A tabela alunos (DB-004) não
-- é tocada.

BEGIN;

DROP TABLE IF EXISTS "convites";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261022120000_criar_convites';

COMMIT;

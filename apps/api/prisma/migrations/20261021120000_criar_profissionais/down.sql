-- DB-003 · Rollback: desfaz a migration 20261021120000_criar_profissionais.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261021120000_criar_profissionais/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FK e CHECK caem junto com a tabela. A tabela usuarios (DB-002) não
-- é tocada.

BEGIN;

DROP TABLE IF EXISTS "profissionais";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261021120000_criar_profissionais';

COMMIT;

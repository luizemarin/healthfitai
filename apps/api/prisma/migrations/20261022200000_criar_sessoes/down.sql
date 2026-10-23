-- DB-006 · Rollback: desfaz a migration 20261022200000_criar_sessoes.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261022200000_criar_sessoes/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela (todo mundo precisa logar de novo). Uso
-- pensado para o banco local/dev. Índices, FK e CHECKs caem junto com a
-- tabela. A tabela usuarios (DB-002) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "sessoes";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261022200000_criar_sessoes';

COMMIT;

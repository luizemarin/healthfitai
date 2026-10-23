-- DB-004 · Rollback: desfaz a migration 20261021220000_criar_alunos.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261021220000_criar_alunos/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto com a tabela. As tabelas usuarios (DB-002)
-- e profissionais (DB-003) não são tocadas.

BEGIN;

-- Primeiro a tabela (ela usa o tipo), depois o tipo.
DROP TABLE IF EXISTS "alunos";
DROP TYPE IF EXISTS "sexo";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261021220000_criar_alunos';

COMMIT;

-- DB-010 · Rollback: desfaz a migration 20261025130000_criar_respostas.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261025130000_criar_respostas/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto com a tabela. As tabelas submissoes
-- (DB-009) e perguntas (DB-008) não são tocadas.

BEGIN;

DROP TABLE IF EXISTS "respostas";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025130000_criar_respostas';

COMMIT;

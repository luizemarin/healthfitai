-- DB-013 · Rollback: desfaz a migration 20261025160000_criar_comentarios_feedback.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261025160000_criar_comentarios_feedback/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECK caem junto com a tabela. As tabelas feedback_envios
-- (DB-012) e profissionais (DB-003) não são tocadas.

BEGIN;

DROP TABLE IF EXISTS "feedback_comentarios";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025160000_criar_comentarios_feedback';

COMMIT;

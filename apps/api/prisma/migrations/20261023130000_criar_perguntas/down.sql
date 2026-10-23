-- DB-008 · Rollback: desfaz a migration 20261023130000_criar_perguntas.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261023130000_criar_perguntas/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FK e CHECKs caem junto com a tabela. A tabela modelos_questionario
-- (DB-007) e o tipo "tipo_pergunta" (DB-001) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "perguntas";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261023130000_criar_perguntas';

COMMIT;

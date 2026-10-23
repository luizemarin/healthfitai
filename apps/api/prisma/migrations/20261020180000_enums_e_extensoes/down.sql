-- DOWN do DB-001: desfaz a migration 20261020180000_enums_e_extensoes.
-- O Prisma não roda este arquivo sozinho. Para executar (a partir de apps/api):
--   npx prisma db execute --file prisma/migrations/20261020180000_enums_e_extensoes/down.sql
-- Depois rode "npm run db:migrate" para aplicar de novo.
BEGIN;

DROP TYPE IF EXISTS "recorrencia";
DROP TYPE IF EXISTS "status_feedback";
DROP TYPE IF EXISTS "tipo_pergunta";
DROP TYPE IF EXISTS "tipo_modelo";
DROP TYPE IF EXISTS "papel";

-- Apaga o registro no histórico do Prisma, para ele considerar a migration como não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261020180000_enums_e_extensoes';

COMMIT;

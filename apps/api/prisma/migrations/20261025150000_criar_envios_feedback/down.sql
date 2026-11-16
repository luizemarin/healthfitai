-- DB-012 · Rollback: desfaz a migration 20261025150000_criar_envios_feedback.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261025150000_criar_envios_feedback/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-013 (feedback_comentarios) já foi aplicado, rode o down.sql
-- dele antes. Sem isso, o DROP abaixo falha de propósito (feedback_comentarios
-- depende desta tabela) e a transação inteira é desfeita: nada é apagado pela
-- metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto com a tabela. As tabelas
-- feedback_agendamentos (DB-011) e submissoes (DB-009) e o tipo
-- "status_feedback" (DB-001) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "feedback_envios";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025150000_criar_envios_feedback';

COMMIT;

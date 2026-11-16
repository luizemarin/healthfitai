-- DB-011 · Rollback: desfaz a migration 20261025140000_criar_agendamentos_feedback.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261025140000_criar_agendamentos_feedback/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-012 (feedback_envios) já foi aplicado, rode o down.sql dele
-- antes (e o do DB-013 antes do DB-012). Sem isso, o DROP abaixo falha de
-- propósito (feedback_envios depende desta tabela) e a transação inteira é
-- desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECK caem junto com a tabela. As tabelas alunos (DB-004) e
-- modelos_questionario (DB-007) e o tipo "recorrencia" (DB-001) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "feedback_agendamentos";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025140000_criar_agendamentos_feedback';

COMMIT;

-- DB-007 · Rollback: desfaz a migration 20261023120000_criar_modelos_questionario.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261023120000_criar_modelos_questionario/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-008 (perguntas) já foi aplicado, rode o down.sql dele antes.
-- Sem isso, o DROP abaixo falha de propósito (perguntas depende desta tabela)
-- e a transação inteira é desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FK e CHECKs caem junto com a tabela. Os tipos "tipo_modelo" (DB-001)
-- e "sexo" (DB-004) e a tabela profissionais (DB-003) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "modelos_questionario";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261023120000_criar_modelos_questionario';

COMMIT;

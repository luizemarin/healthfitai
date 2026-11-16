-- DB-009 · Rollback: desfaz a migration 20261025120000_criar_submissoes.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão. A partir
-- de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261025120000_criar_submissoes/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-010 (respostas) já foi aplicado, rode o down.sql dele antes.
-- Sem isso, o DROP abaixo falha de propósito (respostas depende desta tabela)
-- e a transação inteira é desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FKs e CHECKs caem junto com a tabela. As tabelas alunos (DB-004) e
-- modelos_questionario (DB-007) e o tipo "papel" (DB-001) não são tocados.

BEGIN;

-- Primeiro a tabela (ela usa o tipo), depois o tipo.
DROP TABLE IF EXISTS "submissoes";
DROP TYPE IF EXISTS "status_submissao";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025120000_criar_submissoes';

COMMIT;

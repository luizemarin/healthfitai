-- DB-018 · Rollback: desfaz a migration 20261026160000_criar_responsaveis_e_consentimentos.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026160000_criar_responsaveis_e_consentimentos/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: consentimentos (depende de responsaveis) ->
-- responsaveis -> tipos enum. Tudo numa transação: se um DROP falhar, nada é
-- apagado pela metade.
--
-- ATENÇÃO: apaga responsáveis e consentimentos. Uso pensado para o banco
-- local/dev. Índices, FKs e CHECKs caem junto com as tabelas.
-- O tipo "agente_titular" também é usado por solicitacoes_titular (DB-019):
-- desfaça a DB-019 antes desta (o npm run db:rollback já segue essa ordem).
-- A tabela alunos (DB-004) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "consentimentos";
DROP TABLE IF EXISTS "responsaveis";
DROP TYPE IF EXISTS "agente_titular";
DROP TYPE IF EXISTS "tipo_consentimento";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026160000_criar_responsaveis_e_consentimentos';

COMMIT;

-- DB-019 · Rollback: desfaz a migration 20261026170000_criar_auditoria_e_solicitacoes_titular.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026170000_criar_auditoria_e_solicitacoes_titular/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: tabelas primeiro (elas usam os tipos), depois os
-- tipos criados aqui. Tudo numa transação: se um DROP falhar, nada é apagado
-- pela metade.
--
-- ATENÇÃO: apaga o log de auditoria e os pedidos do titular. Uso pensado para
-- o banco local/dev. Índices, FKs e CHECKs caem junto com as tabelas.
-- O tipo "agente_titular" NÃO é apagado aqui: ele é da DB-018. A tabela
-- alunos (DB-004) também não é tocada.

BEGIN;

DROP TABLE IF EXISTS "solicitacoes_titular";
DROP TABLE IF EXISTS "auditoria";
DROP TYPE IF EXISTS "status_solicitacao";
DROP TYPE IF EXISTS "tipo_solicitacao";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026170000_criar_auditoria_e_solicitacoes_titular';

COMMIT;

-- DB-020 · Rollback: desfaz a migration 20261026180000_criar_fila_notificacoes.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026180000_criar_fila_notificacoes/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro a tabela (ela usa os tipos), depois os
-- tipos. Tudo numa transação: se um DROP falhar, nada é apagado pela metade.
--
-- ATENÇÃO: apaga a fila (inclusive notificações ainda não enviadas). Uso
-- pensado para o banco local/dev. Índices, FK e CHECKs caem junto com a
-- tabela. A tabela usuarios (DB-002) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "notificacoes";
DROP TYPE IF EXISTS "status_notificacao";
DROP TYPE IF EXISTS "canal_notificacao";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026180000_criar_fila_notificacoes';

COMMIT;

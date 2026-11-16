-- DB-026 · Rollback: desfaz a migration 20261026230000_criar_integracoes.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026230000_criar_integracoes/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro a tabela (ela usa o tipo), depois o tipo.
-- Tudo numa transação: se um DROP falhar, nada é apagado pela metade.
--
-- ATENÇÃO: apaga as conexões (os usuários terão de conectar de novo). Uso
-- pensado para o banco local/dev. Índice, FK e CHECKs caem junto com a
-- tabela. A tabela usuarios (DB-002) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "integracoes_externas";
DROP TYPE IF EXISTS "provedor_integracao";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026230000_criar_integracoes';

COMMIT;

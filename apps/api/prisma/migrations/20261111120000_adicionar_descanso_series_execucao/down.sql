-- BE-TRE-02 · Rollback: desfaz a migration 20261111120000_adicionar_descanso_series_execucao.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261111120000_adicionar_descanso_series_execucao
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261111120000_adicionar_descanso_series_execucao/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os descansos registrados. Uso pensado para o banco local/dev.
-- O CHECK cai junto com a coluna. O resto da tabela series_execucao não é tocado.
-- Tudo numa transação: se algo falhar, nada é desfeito pela metade.

BEGIN;

ALTER TABLE "series_execucao" DROP COLUMN IF EXISTS "descanso_segundos";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261111120000_adicionar_descanso_series_execucao';

COMMIT;

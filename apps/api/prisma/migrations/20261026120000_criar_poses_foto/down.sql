-- DB-014 · Rollback: desfaz a migration 20261026120000_criar_poses_foto.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026120000_criar_poses_foto
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026120000_criar_poses_foto/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM: se o DB-015 (fotos) já foi aplicado, rode o down.sql dele antes.
-- Sem isso, o DROP abaixo falha de propósito (fotos depende desta tabela)
-- e a transação inteira é desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Índice, FK e CHECKs caem junto com a tabela. A tabela profissionais
-- (DB-003) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "poses_foto";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026120000_criar_poses_foto';

COMMIT;

-- DB-015 · Rollback: desfaz a migration 20261026130000_criar_fotos.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026130000_criar_fotos/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ATENÇÃO: apaga os registros das fotos (não os arquivos do R2: esses ficam
-- órfãos no bucket). Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto com a tabela. As tabelas alunos (DB-004)
-- e poses_foto (DB-014) e o tipo "papel" (DB-001) não são tocados.

BEGIN;

DROP TABLE IF EXISTS "fotos";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026130000_criar_fotos';

COMMIT;

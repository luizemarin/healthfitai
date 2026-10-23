-- DB-002 · Rollback: desfaz a migration 20261020190000_criar_usuarios.
--
-- O Prisma não roda "down" sozinho; este arquivo é executado à mão (só o
-- migration.sql é lido pelo `prisma migrate`). A partir de apps/api:
--
--   npx prisma db execute --file prisma/migrations/20261020190000_criar_usuarios/down.sql
--   npx prisma migrate resolve --rolled-back 20261020190000_criar_usuarios
--
-- O primeiro comando apaga a tabela; o segundo avisa o Prisma que a migration
-- foi desfeita, para que o próximo `db:migrate` a aplique de novo.
--
-- ATENÇÃO: apaga os dados da tabela. Uso pensado para o banco local/dev.
-- Os índices e o CHECK caem junto com a tabela. O enum "papel" é do DB-001 e
-- fica onde está.

BEGIN;

DROP TABLE IF EXISTS "usuarios";

COMMIT;

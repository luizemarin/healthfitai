-- DB-025 · Rollback: desfaz a migration 20261026220000_criar_nutricao.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026220000_criar_nutricao
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026220000_criar_nutricao/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro os itens (dependem do plano), depois os
-- planos. Tudo numa transação: se um DROP falhar, nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados das tabelas. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto. A tabela alunos (DB-004) não é tocada.

BEGIN;

DROP TABLE IF EXISTS "planos_nutricionais_itens";
DROP TABLE IF EXISTS "planos_nutricionais";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026220000_criar_nutricao';

COMMIT;

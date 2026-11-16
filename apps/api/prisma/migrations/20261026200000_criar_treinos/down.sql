-- DB-023 · Rollback: desfaz a migration 20261026200000_criar_treinos.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback -- 20261026200000_criar_treinos
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026200000_criar_treinos/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro os itens (dependem de treinos), depois
-- treinos. Se o DB-024 (execuções) já foi aplicado, rode o down.sql dele
-- antes (o comando acima já faz isso); sem isso, o DROP falha de propósito e
-- a transação inteira é desfeita: nada é apagado pela metade.
--
-- ATENÇÃO: apaga os dados das tabelas. Uso pensado para o banco local/dev.
-- Índices, FKs e CHECKs caem junto. As tabelas alunos (DB-004) e exercicios
-- (DB-022) não são tocadas.

BEGIN;

DROP TABLE IF EXISTS "treino_exercicios";
DROP TABLE IF EXISTS "treinos";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026200000_criar_treinos';

COMMIT;

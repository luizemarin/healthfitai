-- DB-017 · Rollback: desfaz a migration 20261026150000_criar_tipos_medida_e_registros.
--
-- O Prisma não roda "down" sozinho. Use o script do projeto (a partir de
-- apps/api), que roda os down.sql da mais nova para a mais antiga:
--
--   npm run db:rollback
--
-- ou, só este arquivo, à mão:
--
--   npx prisma db execute --file prisma/migrations/20261026150000_criar_tipos_medida_e_registros/down.sql
--
-- Depois rode "npm run db:migrate" para aplicar de novo.
--
-- ORDEM dentro do arquivo: primeiro registros_medida (depende de
-- tipos_medida), depois tipos_medida. Tudo numa transação: se um DROP
-- falhar, nada é apagado pela metade.
--
-- ATENÇÃO: apaga os tipos e os registros de medida. Uso pensado para o banco
-- local/dev. Índices, FKs e CHECKs caem junto com as tabelas. As tabelas
-- alunos (DB-004) e profissionais (DB-003) e o tipo "papel" (DB-001) não são
-- tocados.

BEGIN;

DROP TABLE IF EXISTS "registros_medida";
DROP TABLE IF EXISTS "tipos_medida";

-- Tira a migration do histórico do Prisma, para ele considerá-la não aplicada.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026150000_criar_tipos_medida_e_registros';

COMMIT;

-- DB-003 · Identidade: tabela de profissionais (dados do personal).
--
-- Relação 1:1 com usuarios: o login fica em usuarios (DB-002) e aqui ficam só
-- os dados próprios do profissional. O UNIQUE em usuario_id é o que garante o
-- 1:1 (um usuário tem no máximo um registro de profissional).
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "profissionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "registro_profissional" VARCHAR(30),

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (garante o 1:1 e já serve de índice para a FK)
CREATE UNIQUE INDEX "profissionais_usuario_id_key" ON "profissionais"("usuario_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar um usuário que ainda é profissional
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "profissionais"
    ADD CONSTRAINT "profissionais_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- registro é opcional, mas quando vier não pode ser texto vazio ("" ou "  ").
-- Sem registro = NULL.
ALTER TABLE "profissionais"
    ADD CONSTRAINT "profissionais_registro_nao_vazio_chk"
    CHECK ("registro_profissional" IS NULL OR btrim("registro_profissional") <> '');

COMMIT;

-- DB-014 · Fotos: tabela de poses de foto.
--
-- A pose diz "qual foto" o aluno tira (ex.: frente, perfil, costas). O app usa
-- a lista ativa, em ordem, para guiar o envio; cada foto aponta para uma pose
-- (DB-015), e é isso que permite comparar a mesma pose em datas diferentes.
--
-- Dono da pose (mesma regra dos modelos de questionário, DB-007):
--   profissional_id preenchido = pose do profissional (só ele vê e edita)
--   profissional_id NULL       = pose padrão do sistema (frente, perfil,
--                                costas). Vem por seed (DB-021) e serve de
--                                base: a API copia as padrão para o
--                                profissional, que então adiciona/remove as dele.
--
-- Remover = desativar (ativa = false): a pose some do app, mas as fotos
-- antigas continuam apontando para ela.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "poses_foto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID,
    "nome" VARCHAR(60) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poses_foto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (app e painel: "minhas poses ativas, em ordem";
-- também acha as padrão com profissional_id IS NULL e serve à FK)
CREATE INDEX "poses_foto_profissional_id_ativa_ordem_idx"
    ON "poses_foto"("profissional_id", "ativa", "ordem");

-- AddForeignKey
-- RESTRICT: não deixa apagar um profissional que tem poses
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "poses_foto"
    ADD CONSTRAINT "poses_foto_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome não pode ser vazio nem só espaços.
ALTER TABLE "poses_foto"
    ADD CONSTRAINT "poses_foto_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

-- ordem começa em 1 (1, 2, 3...).
ALTER TABLE "poses_foto"
    ADD CONSTRAINT "poses_foto_ordem_positiva_chk"
    CHECK ("ordem" >= 1);

COMMIT;

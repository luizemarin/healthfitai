-- DB-022 · Fase 2+ (rascunho, a validar): biblioteca de exercícios.
--
-- Cada profissional tem a sua biblioteca (ex.: "Agachamento livre",
-- grupo "Pernas"). Os treinos (DB-023) apontam para estes exercícios.
--
-- grupo_muscular é texto (não enum) de propósito: a lista ainda não está
-- fechada e cada profissional pode usar a nomenclatura dele. Se virar lista
-- fixa depois, é uma migration nova.
--
-- midia_url: link de um vídeo/imagem de demonstração (ex.: YouTube). Só
-- https. Upload de arquivo próprio (R2, como as fotos) fica para quando o
-- escopo for validado.
--
-- Remover = desativar (ativo = false): o exercício some da biblioteca, mas
-- treinos e execuções antigas continuam apontando para ele.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "exercicios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "grupo_muscular" VARCHAR(60) NOT NULL,
    "descricao" VARCHAR(2000),
    "midia_url" VARCHAR(500),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (biblioteca: "meus exercícios ativos"; também serve à FK)
CREATE INDEX "exercicios_profissional_id_ativo_idx"
    ON "exercicios"("profissional_id", "ativo");

-- AddForeignKey
-- RESTRICT: não deixa apagar um profissional que tem exercícios
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "exercicios"
    ADD CONSTRAINT "exercicios_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome e grupo muscular não podem ser vazios nem só espaços.
ALTER TABLE "exercicios"
    ADD CONSTRAINT "exercicios_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

ALTER TABLE "exercicios"
    ADD CONSTRAINT "exercicios_grupo_muscular_preenchido_chk"
    CHECK (btrim("grupo_muscular") <> '');

-- sem descrição = NULL, nunca texto vazio.
ALTER TABLE "exercicios"
    ADD CONSTRAINT "exercicios_descricao_preenchida_chk"
    CHECK ("descricao" IS NULL OR btrim("descricao") <> '');

-- mídia, se existir, é um link https.
ALTER TABLE "exercicios"
    ADD CONSTRAINT "exercicios_midia_url_https_chk"
    CHECK ("midia_url" IS NULL OR "midia_url" ~ '^https://\S+$');

COMMIT;

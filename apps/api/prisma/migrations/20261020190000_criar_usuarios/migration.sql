-- DB-002 · Identidade: tabela de usuários (login de profissional e aluno).
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Se qualquer
-- comando falhar, o Postgres desfaz os anteriores sozinho (DDL é transacional),
-- então o banco nunca fica "pela metade". Para desfazer depois de aplicada,
-- ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "papel" "papel" NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_papel_idx" ON "usuarios"("papel");

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- e-mail sempre normalizado (minúsculo e sem espaços nas pontas), para que o
-- índice único acima valha sem diferenciar maiúsculas.
ALTER TABLE "usuarios"
    ADD CONSTRAINT "usuarios_email_normalizado_chk"
    CHECK ("email" = lower(btrim("email")));

COMMIT;

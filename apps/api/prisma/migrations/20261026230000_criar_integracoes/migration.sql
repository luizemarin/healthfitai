-- DB-026 · Fase 2+ (rascunho, a validar): integrações externas do usuário
-- (wearables e calendário).
--
-- Uma linha = "o usuário X conectou o provedor Y". Guarda o que o OAuth
-- devolve: tokens, validade e escopo (permissões que o usuário aceitou).
--
-- TOKENS CIFRADOS, nunca em texto puro: a API cifra antes de gravar (ex.:
-- AES-256-GCM, chave só no servidor, na env) e decifra para usar. Não dá para
-- guardar só o hash (como nos convites) porque aqui a API precisa do token
-- de volta para chamar o provedor.
--
-- Tokens são opcionais porque nem todo provedor tem token no servidor: o
-- Apple Health (HealthKit) só existe no aparelho; o app lê lá e manda os
-- dados para a API. A linha registra apenas que o usuário conectou.
--
-- Estado:
--   ativa    = revogado_em NULL
--   revogada = revogado_em preenchido; os tokens são APAGADOS (CHECK), para
--              não sobrar credencial guardada sem uso.
-- Reconectar = nova linha (a antiga fica revogada, como histórico).
-- A API garante uma ativa por (usuário, provedor).
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum
CREATE TYPE "provedor_integracao" AS ENUM ('google_fit', 'apple_health', 'google_calendar');

-- CreateTable
CREATE TABLE "integracoes_externas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "provedor" "provedor_integracao" NOT NULL,
    "access_token_cifrado" TEXT,
    "refresh_token_cifrado" TEXT,
    "token_expira_em" TIMESTAMPTZ(3),
    "escopo" VARCHAR(1000),
    "conectado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogado_em" TIMESTAMPTZ(3),

    CONSTRAINT "integracoes_externas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ("integrações do usuário" e "a do Google Fit dele"; também serve à FK)
CREATE INDEX "integracoes_externas_usuario_id_provedor_idx"
    ON "integracoes_externas"("usuario_id", "provedor");

-- AddForeignKey
-- RESTRICT: não deixa apagar um usuário que tem integrações
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "integracoes_externas"
    ADD CONSTRAINT "integracoes_externas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- tokens e escopo, se existirem, não podem ser vazios (sem valor = NULL).
ALTER TABLE "integracoes_externas"
    ADD CONSTRAINT "integracoes_externas_tokens_preenchidos_chk"
    CHECK (
        ("access_token_cifrado" IS NULL OR btrim("access_token_cifrado") <> '')
        AND ("refresh_token_cifrado" IS NULL OR btrim("refresh_token_cifrado") <> '')
    );

ALTER TABLE "integracoes_externas"
    ADD CONSTRAINT "integracoes_externas_escopo_preenchido_chk"
    CHECK ("escopo" IS NULL OR btrim("escopo") <> '');

-- revogada não guarda credencial.
ALTER TABLE "integracoes_externas"
    ADD CONSTRAINT "integracoes_externas_revogada_sem_tokens_chk"
    CHECK (
        "revogado_em" IS NULL
        OR ("access_token_cifrado" IS NULL AND "refresh_token_cifrado" IS NULL)
    );

-- revogação nunca antes da conexão.
ALTER TABLE "integracoes_externas"
    ADD CONSTRAINT "integracoes_externas_revogado_apos_conectado_chk"
    CHECK ("revogado_em" IS NULL OR "revogado_em" >= "conectado_em");

COMMIT;

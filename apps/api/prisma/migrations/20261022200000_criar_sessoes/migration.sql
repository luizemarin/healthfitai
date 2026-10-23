-- DB-006 · Identidade: tabela de sessões (refresh tokens).
--
-- Cada login gera uma sessão. A API devolve ao app um access token curto
-- (JWT, não fica no banco) e um refresh token longo, que é este registro.
-- Quando o access token vence, o app manda o refresh token e ganha um novo par.
--
-- Segurança: igual aos convites (DB-005), o refresh token NUNCA é gravado,
-- só o hash dele (SHA-256 em hex, 64 caracteres). Se o banco vazar, ninguém
-- consegue se passar pelo usuário. SHA-256 (e não bcrypt/argon2) porque o
-- token já é aleatório e longo, e a API precisa achar a sessão pelo hash
-- (busca direta pelo índice único).
--
-- Estado da sessão (calculado, nunca guardado numa coluna "status"):
--   ativa     = revogado_em IS NULL AND expira_em > now()
--   revogada  = revogado_em IS NOT NULL   (logout, troca de senha, rotação)
--   expirada  = revogado_em IS NULL AND expira_em <= now()
--
-- Rotação: a cada refresh, a sessão usada é revogada e uma nova é criada.
-- Nada é sobrescrito.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "revogado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (token único; é por aqui que a API acha a sessão no refresh)
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex (sessões de um usuário: "sair de todos os dispositivos"; também serve à FK)
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar um usuário que tem sessão
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "sessoes"
    ADD CONSTRAINT "sessoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- token_hash é SHA-256 em hex minúsculo. Barra gravar o token puro por engano.
ALTER TABLE "sessoes"
    ADD CONSTRAINT "sessoes_token_hash_formato_chk"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- a sessão precisa vencer depois de ser criada.
ALTER TABLE "sessoes"
    ADD CONSTRAINT "sessoes_expira_depois_de_criada_chk"
    CHECK ("expira_em" > "criado_em");

COMMIT;

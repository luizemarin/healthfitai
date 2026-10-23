-- DB-005 · Identidade: tabela de convites.
--
-- O profissional cadastra o aluno (DB-004) e gera um convite. O aluno recebe
-- um link com um token aleatório e, ao abrir, ativa a conta (aí alunos.usuario_id
-- passa a ser preenchido).
--
-- Segurança: o token em si NUNCA é gravado, só o hash dele (SHA-256 em hex,
-- 64 caracteres). Se o banco vazar, ninguém consegue montar um link válido.
-- SHA-256 (e não bcrypt/argon2) porque o token já é aleatório e longo, e a
-- API precisa achar o convite pelo hash (busca direta pelo índice único).
--
-- Estado do convite (calculado, nunca guardado numa coluna "status"):
--   válido    = usado_em IS NULL AND revogado_em IS NULL AND expira_em > now()
--   usado     = usado_em IS NOT NULL
--   revogado  = revogado_em IS NOT NULL
--   expirado  = nenhum dos dois e expira_em <= now()
--
-- Nada é apagado nem sobrescrito: reenviar convite = revogar o anterior e
-- criar um novo registro. O histórico fica.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (token único; é por aqui que a API acha o convite ao abrir o link)
CREATE UNIQUE INDEX "convites_token_hash_key" ON "convites"("token_hash");

-- CreateIndex (convites de um aluno, do mais novo ao mais antigo; também serve à FK)
CREATE INDEX "convites_aluno_id_criado_em_idx" ON "convites"("aluno_id", "criado_em");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno que tem convite
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "convites"
    ADD CONSTRAINT "convites_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- token_hash é SHA-256 em hex minúsculo. Barra gravar o token puro por engano.
ALTER TABLE "convites"
    ADD CONSTRAINT "convites_token_hash_formato_chk"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- o convite precisa vencer depois de ser criado.
ALTER TABLE "convites"
    ADD CONSTRAINT "convites_expira_depois_de_criado_chk"
    CHECK ("expira_em" > "criado_em");

-- um convite termina de um jeito só: ou foi usado, ou foi revogado.
ALTER TABLE "convites"
    ADD CONSTRAINT "convites_usado_ou_revogado_chk"
    CHECK ("usado_em" IS NULL OR "revogado_em" IS NULL);

COMMIT;

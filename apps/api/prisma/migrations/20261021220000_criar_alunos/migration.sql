-- DB-004 · Identidade: tabela de alunos.
--
-- O aluno nasce pelo cadastro do profissional, ainda sem login: usuario_id
-- fica NULL até ele ativar a conta pelo convite (DB-005). Quando ativa, passa
-- a apontar para usuarios (1:1, garantido pelo UNIQUE).
--
-- data_nascimento é obrigatória: é por ela que o sistema sabe se o aluno é
-- menor de idade (LG-MEN-01). A idade é calculada, nunca guardada.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum (define qual anamnese o aluno recebe: masculina ou feminina)
CREATE TYPE "sexo" AS ENUM ('masculino', 'feminino');

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "profissional_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "sexo" "sexo" NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "email" VARCHAR(254),
    "telefone" VARCHAR(11),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (1:1 com usuarios; vários NULL são permitidos)
CREATE UNIQUE INDEX "alunos_usuario_id_key" ON "alunos"("usuario_id");

-- CreateIndex (listagem do painel: "meus alunos ativos"; também serve à FK)
CREATE INDEX "alunos_profissional_id_ativo_idx" ON "alunos"("profissional_id", "ativo");

-- CreateIndex (mesmo e-mail não se repete no mesmo profissional; NULL não conta)
CREATE UNIQUE INDEX "alunos_profissional_id_email_key" ON "alunos"("profissional_id", "email");

-- AddForeignKey
-- RESTRICT: não deixa apagar usuário/profissional que ainda tem aluno
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "alunos"
    ADD CONSTRAINT "alunos_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alunos"
    ADD CONSTRAINT "alunos_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- e-mail normalizado (minúsculo, sem espaços nas pontas), igual a usuarios.
ALTER TABLE "alunos"
    ADD CONSTRAINT "alunos_email_normalizado_chk"
    CHECK ("email" IS NULL OR "email" = lower(btrim("email")));

-- telefone só com dígitos: DDD + número (10 ou 11 dígitos).
ALTER TABLE "alunos"
    ADD CONSTRAINT "alunos_telefone_digitos_chk"
    CHECK ("telefone" IS NULL OR "telefone" ~ '^[0-9]{10,11}$');

COMMIT;

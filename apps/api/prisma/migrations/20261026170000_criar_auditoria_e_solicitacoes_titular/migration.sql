-- DB-019 · Transversal (LGPD): auditoria e solicitações do titular.
--
-- Duas tabelas:
--
--   auditoria            = "quem fez o quê, em qual registro, quando e de onde".
--                          Ex.: profissional abriu a anamnese do aluno X;
--                          responsável confirmou o e-mail (LG-MEN-04).
--   solicitacoes_titular = pedidos do titular (ou do responsável, se menor)
--                          pelos direitos da LGPD (art. 18): acesso,
--                          exportação, correção, exclusão, revogação
--                          (LG-DIR-01..05).
--
-- Auditoria
--   Só se INSERE (log). Nunca se edita nem apaga uma linha.
--   usuario_id NULL = ação sem login: responsável pelo link mágico ou job do
--   sistema.
--   Sem FK de propósito: o log precisa sobreviver a qualquer coisa que
--   aconteça com o registro auditado (inclusive exclusão/anonimização,
--   LG-DIR-03). Por isso entidade_id também não tem FK: aponta para tabelas
--   diferentes conforme "entidade".
--   Nunca gravar dado sensível aqui (LG-SEG-01): só ids, a ação e o IP.
--
-- Solicitação do titular
--   status: aberta -> em_andamento -> concluida | recusada
--   concluido_em é preenchido quando ela termina (concluída ou recusada); o
--   banco garante isso com CHECK. O prazo de resposta é calculado pela API a
--   partir de criado_em (não é guardado).
--
-- Tudo dentro de uma transação: ou cria tudo, ou nada. Para desfazer depois
-- de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum
CREATE TYPE "tipo_solicitacao" AS ENUM ('acesso', 'exportacao', 'correcao', 'exclusao', 'revogacao');

-- CreateEnum
CREATE TYPE "status_solicitacao" AS ENUM ('aberta', 'em_andamento', 'concluida', 'recusada');

-- ─── auditoria ──────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "acao" VARCHAR(60) NOT NULL,
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" INET,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ("histórico de acessos da anamnese X")
CREATE INDEX "auditoria_entidade_entidade_id_idx"
    ON "auditoria"("entidade", "entidade_id");

-- CreateIndex ("o que o usuário Y fez", em ordem de data)
CREATE INDEX "auditoria_usuario_id_criado_em_idx"
    ON "auditoria"("usuario_id", "criado_em");

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- ação e entidade não podem ser vazias (ex.: acao = 'anamnese.visualizar',
-- entidade = 'submissoes').
ALTER TABLE "auditoria"
    ADD CONSTRAINT "auditoria_acao_preenchida_chk"
    CHECK (btrim("acao") <> '');

ALTER TABLE "auditoria"
    ADD CONSTRAINT "auditoria_entidade_preenchida_chk"
    CHECK (btrim("entidade") <> '');

-- ─── solicitacoes_titular ───────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "solicitacoes_titular" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "solicitante" "agente_titular" NOT NULL,
    "tipo" "tipo_solicitacao" NOT NULL,
    "status" "status_solicitacao" NOT NULL DEFAULT 'aberta',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(3),

    CONSTRAINT "solicitacoes_titular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (pedidos do aluno em ordem; também serve à FK)
CREATE INDEX "solicitacoes_titular_aluno_id_criado_em_idx"
    ON "solicitacoes_titular"("aluno_id", "criado_em");

-- CreateIndex (painel: "pedidos em aberto, mais antigos primeiro")
CREATE INDEX "solicitacoes_titular_status_criado_em_idx"
    ON "solicitacoes_titular"("status", "criado_em");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno com pedidos registrados (exclusão
-- pela LGPD é anonimização, não DELETE do aluno).
ALTER TABLE "solicitacoes_titular"
    ADD CONSTRAINT "solicitacoes_titular_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual:
-- terminou (concluida/recusada) <=> concluido_em preenchido.
ALTER TABLE "solicitacoes_titular"
    ADD CONSTRAINT "solicitacoes_titular_concluido_coerente_chk"
    CHECK (("status" IN ('concluida', 'recusada')) = ("concluido_em" IS NOT NULL));

-- não termina antes de começar.
ALTER TABLE "solicitacoes_titular"
    ADD CONSTRAINT "solicitacoes_titular_concluido_apos_criacao_chk"
    CHECK ("concluido_em" IS NULL OR "concluido_em" >= "criado_em");

COMMIT;

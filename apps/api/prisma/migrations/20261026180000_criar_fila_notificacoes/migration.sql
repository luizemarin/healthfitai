-- DB-020 · Transversal: fila de notificações (e-mail e push).
--
-- Em vez de mandar o e-mail no meio da requisição, a API só INSERE uma linha
-- aqui. Um job (worker) lê a fila e envia. Assim: a requisição não fica
-- lenta, uma falha no provedor de e-mail não quebra o fluxo, e dá para
-- tentar de novo. Pode virar uma fila externa no futuro (ex.: SQS) sem
-- mudar quem enfileira.
--
-- Como o worker usa:
--   1. pega as "pendente" com agendada_para <= agora
--      (SELECT ... FOR UPDATE SKIP LOCKED: dois workers não pegam a mesma)
--   2. marca "enviando" e soma 1 em tentativas
--   3. deu certo -> "enviada"
--      deu erro  -> volta para "pendente" com agendada_para mais à frente;
--                   passou do limite de tentativas -> "falhou"
--
-- AJUSTE em relação à planilha (explicado):
--   usuario_id é OPCIONAL e existe a coluna "destino". Motivo: os primeiros
--   e-mails vão para quem ainda NÃO tem conta (convite do aluno, DB-005, e
--   convite do responsável, LG-MEN-03). destino = e-mail (ou token de push)
--   para onde vai a mensagem, resolvido na hora de enfileirar.
--
-- template: qual mensagem (ex.: 'convite_aluno', 'lembrete_feedback').
-- payload: só os dados que o template precisa (ex.: o link). NUNCA dado de
--   saúde nem foto (LG-SEG-02).
--
-- Tudo dentro de uma transação: ou cria tudo, ou nada. Para desfazer depois
-- de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum
CREATE TYPE "canal_notificacao" AS ENUM ('email', 'push');

-- CreateEnum
CREATE TYPE "status_notificacao" AS ENUM ('pendente', 'enviando', 'enviada', 'falhou');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "canal" "canal_notificacao" NOT NULL,
    "destino" VARCHAR(254) NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "status_notificacao" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "agendada_para" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (o worker: "pendentes que já venceram", na ordem)
CREATE INDEX "notificacoes_status_agendada_para_idx"
    ON "notificacoes"("status", "agendada_para");

-- CreateIndex (serve à FK de usuario_id)
CREATE INDEX "notificacoes_usuario_id_idx" ON "notificacoes"("usuario_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar um usuário que tem notificações
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- destino e template não podem ser vazios.
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_destino_preenchido_chk"
    CHECK (btrim("destino") <> '');

ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_template_preenchido_chk"
    CHECK (btrim("template") <> '');

-- payload é sempre um objeto JSON ({ ... }), nunca lista/texto solto.
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_payload_objeto_chk"
    CHECK (jsonb_typeof("payload") = 'object');

-- tentativas nunca é negativa.
ALTER TABLE "notificacoes"
    ADD CONSTRAINT "notificacoes_tentativas_nao_negativa_chk"
    CHECK ("tentativas" >= 0);

COMMIT;

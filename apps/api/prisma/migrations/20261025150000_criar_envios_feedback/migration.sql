-- DB-012 · Feedbacks: tabela de envios de feedback (cada liberação).
--
-- Cada vez que um agendamento (DB-011) libera o feedback, nasce UM envio.
-- O envio guarda o link do aluno (só o hash do token) e acompanha o ciclo
-- de vida até a resposta. A resposta em si é uma submissão (DB-009).
--
-- Ciclo de vida (status, reaproveita o tipo "status_feedback" do DB-001):
--   agendado   -> envio criado, e-mail ainda não saiu.
--   enviado    -> e-mail saiu (enviado_em preenchido).
--   atrasado   -> passou o prazo de lembrete sem resposta; o lembrete foi
--                 mandado (lembrete_em preenchido).
--   respondido -> aluno enviou a submissão final (respondido_em preenchido).
--
-- Datas = fatos: cada coluna *_em registra QUANDO aquilo aconteceu. O banco
-- garante que status e datas combinam (CHECKs no fim).
--
-- submissao_id: nulo até o aluno começar a responder (o rascunho do autosave
-- já cria a submissão). Único: uma submissão responde um envio só.
--
-- token_hash: SHA-256 em hex do token do link (igual a convites, DB-005).
-- O token puro vai só no e-mail.
--
-- Como o job de lembrete usa o índice (status, enviado_em):
--   busca status = 'enviado' com enviado_em + lembrete_dias <= agora,
--   manda o lembrete, grava lembrete_em e muda para 'atrasado'.
--
-- Nunca sobrescrever: liberar de novo = novo envio.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "feedback_envios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agendamento_id" UUID NOT NULL,
    "submissao_id" UUID,
    "status" "status_feedback" NOT NULL DEFAULT 'agendado',
    "token_hash" CHAR(64) NOT NULL,
    "enviado_em" TIMESTAMPTZ(3),
    "lembrete_em" TIMESTAMPTZ(3),
    "respondido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (o link do aluno é procurado por aqui)
CREATE UNIQUE INDEX "feedback_envios_token_hash_key"
    ON "feedback_envios"("token_hash");

-- CreateIndex (1:1 com submissoes; vários NULL são permitidos; serve à FK)
CREATE UNIQUE INDEX "feedback_envios_submissao_id_key"
    ON "feedback_envios"("submissao_id");

-- CreateIndex (histórico de envios de um agendamento; também serve à FK)
CREATE INDEX "feedback_envios_agendamento_id_criado_em_idx"
    ON "feedback_envios"("agendamento_id", "criado_em");

-- CreateIndex (jobs e painel: "próxima ação" por status)
CREATE INDEX "feedback_envios_status_enviado_em_idx"
    ON "feedback_envios"("status", "enviado_em");

-- AddForeignKey
-- RESTRICT: não deixa apagar agendamento nem submissão que têm envios
-- (é histórico; a regra é desativar o agendamento).
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_agendamento_id_fkey"
    FOREIGN KEY ("agendamento_id") REFERENCES "feedback_agendamentos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_submissao_id_fkey"
    FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- token_hash é SHA-256 em hex minúsculo. Barra gravar o token puro por engano.
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_token_hash_formato_chk"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- só 'agendado' não tem data de envio; os outros status têm.
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_enviado_em_por_status_chk"
    CHECK (("status" = 'agendado') = ("enviado_em" IS NULL));

-- 'respondido' tem data de resposta e submissão; os outros não têm data.
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_respondido_por_status_chk"
    CHECK (
        ("status" = 'respondido') = ("respondido_em" IS NOT NULL)
        AND ("status" <> 'respondido' OR "submissao_id" IS NOT NULL)
    );

-- 'atrasado' sempre teve lembrete enviado.
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_atrasado_tem_lembrete_chk"
    CHECK ("status" <> 'atrasado' OR "lembrete_em" IS NOT NULL);

-- as datas seguem a ordem natural: envio antes do lembrete e da resposta.
ALTER TABLE "feedback_envios"
    ADD CONSTRAINT "feedback_envios_ordem_datas_chk"
    CHECK (
        ("lembrete_em" IS NULL OR "lembrete_em" >= "enviado_em")
        AND ("respondido_em" IS NULL OR "respondido_em" >= "enviado_em")
    );

COMMIT;

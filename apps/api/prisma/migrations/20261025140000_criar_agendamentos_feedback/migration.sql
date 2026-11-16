-- DB-011 · Feedbacks: tabela de agendamentos de feedback (a "regra" de envio).
--
-- Um agendamento diz: "o aluno X recebe o questionário de feedback Y com esta
-- frequência". Ele NÃO é o envio em si: cada vez que o feedback é liberado,
-- nasce um registro em feedback_envios (DB-012).
--
-- Como o job de liberação usa esta tabela:
--   1. busca agendamentos ativos com proxima_liberacao <= agora;
--   2. cria o envio (DB-012) e manda o e-mail com o link;
--   3. avança proxima_liberacao conforme a recorrência
--      (semanal +7 dias, quinzenal +14, mensal +1 mês).
--      avulso = liberado uma vez só: a API marca ativo = false depois do envio.
--
-- lembrete_dias: quantos dias depois do envio, sem resposta, o aluno recebe
-- um lembrete. NULL = sem lembrete.
--
-- Reaproveita o tipo "recorrencia" do DB-001.
-- Regra entre tabelas que a API valida: o modelo precisa ser do tipo
-- 'feedback' e pertencer ao profissional do aluno (ou ser modelo padrão).
--
-- Desativar em vez de apagar: os envios antigos continuam apontando para cá.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "feedback_agendamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "modelo_id" UUID NOT NULL,
    "recorrencia" "recorrencia" NOT NULL,
    "proxima_liberacao" TIMESTAMPTZ(3) NOT NULL,
    "lembrete_dias" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (painel: "feedbacks ativos do João"; também serve à FK de aluno_id)
CREATE INDEX "feedback_agendamentos_aluno_id_ativo_idx"
    ON "feedback_agendamentos"("aluno_id", "ativo");

-- CreateIndex (serve à FK de modelo_id: "quem usa este modelo?")
CREATE INDEX "feedback_agendamentos_modelo_id_idx"
    ON "feedback_agendamentos"("modelo_id");

-- CreateIndex (job de liberação: ativos com proxima_liberacao vencida)
CREATE INDEX "feedback_agendamentos_ativo_proxima_liberacao_idx"
    ON "feedback_agendamentos"("ativo", "proxima_liberacao");

-- AddForeignKey
-- RESTRICT: não deixa apagar aluno nem modelo que têm agendamentos
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "feedback_agendamentos"
    ADD CONSTRAINT "feedback_agendamentos_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "feedback_agendamentos"
    ADD CONSTRAINT "feedback_agendamentos_modelo_id_fkey"
    FOREIGN KEY ("modelo_id") REFERENCES "modelos_questionario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- lembrete, se existir, é de pelo menos 1 dia (0 ou negativo não faz sentido).
ALTER TABLE "feedback_agendamentos"
    ADD CONSTRAINT "feedback_agendamentos_lembrete_dias_positivo_chk"
    CHECK ("lembrete_dias" IS NULL OR "lembrete_dias" >= 1);

COMMIT;

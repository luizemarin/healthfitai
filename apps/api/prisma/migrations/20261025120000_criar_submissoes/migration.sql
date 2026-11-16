-- DB-009 · Respostas: tabela de submissões (o "envio" de um questionário).
--
-- Uma submissão é uma vez em que um questionário (DB-007) foi preenchido para
-- um aluno (DB-004). As respostas de cada pergunta ficam em respostas (DB-010).
--
-- Ciclo de vida (status):
--   rascunho -> o aluno/profissional está preenchendo; a API salva sozinha
--               (autosave). respondido_em fica NULL.
--   final    -> enviado. respondido_em é preenchido e a submissão não muda mais.
--
-- NUNCA SOBRESCREVER: responder de novo (ex.: a anamnese do ano seguinte)
-- cria OUTRA submissão. Assim o histórico e o gráfico de evolução ficam
-- completos. Só um rascunho pode ser editado.
--
-- versao: cópia da versão do modelo no momento do preenchimento. Se o
-- profissional editar o modelo depois, dá para saber qual versão foi respondida.
--
-- preenchido_por: QUEM preencheu, pelo papel (reaproveita o tipo "papel" do
-- DB-001). Anamnese e feedback = aluno; avaliação física = profissional.
-- Não é FK para usuarios porque o aluno pode responder pelo link do convite
-- antes de ter conta; e quem é cada um já se sabe por aluno_id (o aluno e o
-- profissional dono dele).
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum
CREATE TYPE "status_submissao" AS ENUM ('rascunho', 'final');

-- CreateTable
CREATE TABLE "submissoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "modelo_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "status_submissao" NOT NULL DEFAULT 'rascunho',
    "preenchido_por" "papel" NOT NULL,
    "respondido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (histórico do aluno em ordem de data: "anamneses do João";
-- também serve à FK de aluno_id)
CREATE INDEX "submissoes_aluno_id_respondido_em_idx"
    ON "submissoes"("aluno_id", "respondido_em");

-- AddForeignKey
-- RESTRICT: não deixa apagar aluno nem modelo que têm submissões
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "submissoes"
    ADD CONSTRAINT "submissoes_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submissoes"
    ADD CONSTRAINT "submissoes_modelo_id_fkey"
    FOREIGN KEY ("modelo_id") REFERENCES "modelos_questionario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- versão do modelo começa em 1 (igual ao DB-007).
ALTER TABLE "submissoes"
    ADD CONSTRAINT "submissoes_versao_positiva_chk"
    CHECK ("versao" >= 1);

-- final tem data de resposta; rascunho não tem.
ALTER TABLE "submissoes"
    ADD CONSTRAINT "submissoes_respondido_em_por_status_chk"
    CHECK (("status" = 'final') = ("respondido_em" IS NOT NULL));

COMMIT;

-- DB-013 · Feedbacks: tabela de comentários do profissional nos feedbacks.
--
-- Depois que o aluno responde um feedback (DB-012), o profissional pode
-- deixar comentários. O aluno vê esses comentários no app.
--
-- Nada é sobrescrito: corrigir um comentário = escrever outro. Por isso não
-- há atualizado_em.
--
-- Regra entre tabelas que a API valida: o profissional precisa ser o dono do
-- aluno do envio.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "feedback_comentarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "envio_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (comentários de um envio em ordem; também serve à FK de envio_id)
CREATE INDEX "feedback_comentarios_envio_id_criado_em_idx"
    ON "feedback_comentarios"("envio_id", "criado_em");

-- CreateIndex (serve à FK de profissional_id)
CREATE INDEX "feedback_comentarios_profissional_id_idx"
    ON "feedback_comentarios"("profissional_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar envio nem profissional que têm comentários
-- (é histórico que o aluno vê).
ALTER TABLE "feedback_comentarios"
    ADD CONSTRAINT "feedback_comentarios_envio_id_fkey"
    FOREIGN KEY ("envio_id") REFERENCES "feedback_envios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "feedback_comentarios"
    ADD CONSTRAINT "feedback_comentarios_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- comentário não pode ser vazio nem só espaços.
ALTER TABLE "feedback_comentarios"
    ADD CONSTRAINT "feedback_comentarios_texto_preenchido_chk"
    CHECK (btrim("texto") <> '');

COMMIT;

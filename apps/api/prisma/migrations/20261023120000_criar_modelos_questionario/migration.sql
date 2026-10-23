-- DB-007 · Questionários: tabela de modelos de questionário.
--
-- Um motor só serve os três usos (tipo_modelo, DB-001): anamnese, avaliação e
-- feedback. O modelo é o "cabeçalho"; as perguntas ficam em perguntas (DB-008).
--
-- Dono do modelo:
--   profissional_id preenchido = modelo do profissional (só ele vê e edita)
--   profissional_id NULL       = modelo padrão do sistema, sem dono (ex.:
--                                anamnese M/F, avaliação postural). Vem por seed
--                                (DB-021) e serve de base para duplicar.
--
-- sexo_alvo: para qual sexo o modelo foi feito (anamnese masculina/feminina).
-- NULL = serve para qualquer aluno. Reaproveita o tipo "sexo" do DB-004.
--
-- Duplicar = novo registro (nunca altera o original). versao começa em 1 e a
-- API incrementa quando o conteúdo muda; as respostas guardam a versão que
-- o aluno respondeu (DB-009), então o histórico não se perde.
--
-- Desativar em vez de apagar (ativo = false): o modelo some das listas, mas
-- as respostas antigas continuam apontando para ele.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "modelos_questionario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID,
    "tipo" "tipo_modelo" NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "sexo_alvo" "sexo",
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_questionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (listagem do painel: "meus modelos de anamnese ativos";
-- também acha os padrões com profissional_id IS NULL e serve à FK)
CREATE INDEX "modelos_questionario_profissional_id_tipo_ativo_idx"
    ON "modelos_questionario"("profissional_id", "tipo", "ativo");

-- AddForeignKey
-- RESTRICT: não deixa apagar um profissional que tem modelos
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "modelos_questionario"
    ADD CONSTRAINT "modelos_questionario_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome não pode ser vazio nem só espaços.
ALTER TABLE "modelos_questionario"
    ADD CONSTRAINT "modelos_questionario_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

-- versão começa em 1 e só sobe.
ALTER TABLE "modelos_questionario"
    ADD CONSTRAINT "modelos_questionario_versao_positiva_chk"
    CHECK ("versao" >= 1);

COMMIT;

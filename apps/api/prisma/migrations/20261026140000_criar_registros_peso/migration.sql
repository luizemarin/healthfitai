-- DB-016 · Medidas: tabela de registros de peso do aluno.
--
-- Cada pesagem é uma linha. É daqui que sai a curva de peso do gráfico de
-- evolução.
--
--   peso_kg        = peso em quilos, com até 2 casas (ex.: 72.35).
--   data_registro  = dia da pesagem. É por ela que o gráfico ordena os pontos.
--   registrado_por = quem lançou: aluno (app) ou profissional (painel).
--                    Reaproveita o tipo "papel" do DB-001.
--
-- Nada é sobrescrito: pesou de novo = novo registro. Por isso não há
-- atualizado_em. Pode haver mais de um registro no mesmo dia (ex.: corrigir
-- um valor lançado errado); o gráfico usa o mais recente pelo criado_em.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "registros_peso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "peso_kg" DECIMAL(5,2) NOT NULL,
    "data_registro" DATE NOT NULL,
    "registrado_por" "papel" NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_peso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (gráfico de peso do aluno em ordem de data; também serve à FK)
CREATE INDEX "registros_peso_aluno_id_data_registro_idx"
    ON "registros_peso"("aluno_id", "data_registro");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno que tem pesagens
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "registros_peso"
    ADD CONSTRAINT "registros_peso_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- peso precisa ser realista. Barra zero, negativo e erro de digitação
-- grosseiro (ex.: 7235 em vez de 72.35). DECIMAL(5,2) já limita a 999.99.
ALTER TABLE "registros_peso"
    ADD CONSTRAINT "registros_peso_peso_kg_faixa_chk"
    CHECK ("peso_kg" > 0 AND "peso_kg" <= 500);

COMMIT;

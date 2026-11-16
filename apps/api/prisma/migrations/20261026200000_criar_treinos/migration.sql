-- DB-023 · Fase 2+ (rascunho, a validar): treinos e os exercícios de cada treino.
--
--   treinos            = o "cabeçalho": de qual aluno e o nome (ex.: "Treino A")
--   treino_exercicios  = os itens, em ordem: qual exercício (DB-022), quantas
--                        séries, repetições, descanso e carga
--
-- repeticoes é texto curto de propósito: personal escreve "12", "8-12" ou
-- "até a falha". O que o aluno FEZ de verdade (número) vai na execução (DB-024).
--
-- carga_kg: NULL = sem carga prescrita (ex.: peso do corpo).
--
-- Duplicar treino = novo treino com cópia dos itens (feito pela API).
-- Remover treino = desativar (ativo = false). Os itens são parte do treino:
-- a API pode editá-los/removê-los livremente, porque o histórico de execução
-- (DB-024) aponta para o EXERCÍCIO, não para o item.
-- A API valida que o exercício é do profissional do aluno.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "treinos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treino_exercicios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "treino_id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticoes" VARCHAR(20) NOT NULL,
    "descanso_segundos" INTEGER NOT NULL,
    "carga_kg" DECIMAL(6,2),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treino_exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (app e painel: "treinos ativos do aluno"; também serve à FK)
CREATE INDEX "treinos_aluno_id_ativo_idx" ON "treinos"("aluno_id", "ativo");

-- CreateIndex (uma posição por treino; também serve à FK e já devolve os
-- itens na ordem certa)
CREATE UNIQUE INDEX "treino_exercicios_treino_id_ordem_key"
    ON "treino_exercicios"("treino_id", "ordem");

-- CreateIndex (serve à FK de exercicio_id)
CREATE INDEX "treino_exercicios_exercicio_id_idx" ON "treino_exercicios"("exercicio_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno que tem treinos (desativar, não apagar).
ALTER TABLE "treinos"
    ADD CONSTRAINT "treinos_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- CASCADE: o item é parte do treino (mesma regra de respostas -> submissões).
ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_treino_id_fkey"
    FOREIGN KEY ("treino_id") REFERENCES "treinos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- RESTRICT: não deixa apagar um exercício usado em treino (desativar, não apagar).
ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_exercicio_id_fkey"
    FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome do treino não pode ser vazio.
ALTER TABLE "treinos"
    ADD CONSTRAINT "treinos_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

-- ordem começa em 1; pelo menos 1 série.
ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_ordem_positiva_chk"
    CHECK ("ordem" >= 1);

ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_series_positiva_chk"
    CHECK ("series" >= 1);

-- repetições não pode ser vazio.
ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_repeticoes_preenchida_chk"
    CHECK (btrim("repeticoes") <> '');

-- descanso e carga nunca negativos (0 = sem descanso).
ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_descanso_nao_negativo_chk"
    CHECK ("descanso_segundos" >= 0);

ALTER TABLE "treino_exercicios"
    ADD CONSTRAINT "treino_exercicios_carga_nao_negativa_chk"
    CHECK ("carga_kg" IS NULL OR "carga_kg" >= 0);

COMMIT;

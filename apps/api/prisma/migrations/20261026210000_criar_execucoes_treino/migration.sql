-- DB-024 · Fase 2+ (rascunho, a validar): execuções de treino e as séries feitas.
--
--   execucoes_treino = "o aluno fez o Treino A em tal dia, durou X minutos"
--   series_execucao  = cada série feita: exercício, nº da série, repetições e
--                      carga reais
--
-- Como o app usa: o aluno treina com o app (cronômetro, descanso, anota
-- carga/reps) e, ao FINALIZAR, o app manda a execução inteira de uma vez.
-- Por isso duração é obrigatória e não há "atualizado_em": a execução já
-- nasce completa e nada é sobrescrito (treinou de novo = nova execução).
-- Funciona bem offline: o app guarda local e envia quando tiver internet.
--
-- A série aponta para o EXERCÍCIO (DB-022), não para o item do treino
-- (DB-023). Assim, o personal pode editar o treino sem quebrar o histórico,
-- e o gráfico "carga do agachamento ao longo do tempo" sai direto daqui.
--
-- aluno_id repete o dono do treino de propósito: o painel conta frequência
-- ("quantas vezes o aluno treinou no mês") sem precisar de JOIN.
-- A API valida que o treino é do aluno.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "execucoes_treino" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "treino_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL,
    "duracao_segundos" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execucoes_treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_execucao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "execucao_id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "serie" INTEGER NOT NULL,
    "repeticoes" INTEGER NOT NULL,
    "carga_kg" DECIMAL(6,2),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_execucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (painel: frequência do aluno por data; também serve à FK)
CREATE INDEX "execucoes_treino_aluno_id_iniciado_em_idx"
    ON "execucoes_treino"("aluno_id", "iniciado_em");

-- CreateIndex (serve à FK de treino_id: "execuções deste treino")
CREATE INDEX "execucoes_treino_treino_id_idx" ON "execucoes_treino"("treino_id");

-- CreateIndex (uma linha por série de cada exercício na execução; evita
-- duplicar se o app reenviar; também serve à FK)
CREATE UNIQUE INDEX "series_execucao_execucao_id_exercicio_id_serie_key"
    ON "series_execucao"("execucao_id", "exercicio_id", "serie");

-- CreateIndex (gráfico de carga por exercício; também serve à FK)
CREATE INDEX "series_execucao_exercicio_id_idx" ON "series_execucao"("exercicio_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar aluno nem treino com histórico (desativar, não apagar).
ALTER TABLE "execucoes_treino"
    ADD CONSTRAINT "execucoes_treino_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "execucoes_treino"
    ADD CONSTRAINT "execucoes_treino_treino_id_fkey"
    FOREIGN KEY ("treino_id") REFERENCES "treinos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- CASCADE: a série é parte da execução (mesma regra de respostas -> submissões).
ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_execucao_id_fkey"
    FOREIGN KEY ("execucao_id") REFERENCES "execucoes_treino"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT: não deixa apagar exercício com histórico (desativar, não apagar).
ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_exercicio_id_fkey"
    FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- duração maior que zero.
ALTER TABLE "execucoes_treino"
    ADD CONSTRAINT "execucoes_treino_duracao_positiva_chk"
    CHECK ("duracao_segundos" > 0);

-- série começa em 1; repetições e carga nunca negativas.
ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_serie_positiva_chk"
    CHECK ("serie" >= 1);

ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_repeticoes_nao_negativa_chk"
    CHECK ("repeticoes" >= 0);

ALTER TABLE "series_execucao"
    ADD CONSTRAINT "series_execucao_carga_nao_negativa_chk"
    CHECK ("carga_kg" IS NULL OR "carga_kg" >= 0);

COMMIT;

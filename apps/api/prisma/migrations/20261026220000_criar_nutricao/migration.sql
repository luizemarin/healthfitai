-- DB-025 · Fase 2+ (escopo a detalhar): planos nutricionais e seus itens.
--
-- Como o escopo ainda está "a definir", esta é a versão MÍNIMA que já serve:
--
--   planos_nutricionais        = o plano do aluno (ex.: "Plano cutting - out/26")
--   planos_nutricionais_itens  = as refeições do plano, em ordem:
--                                refeição ("Café da manhã"), horário sugerido
--                                (opcional) e a descrição em texto livre
--                                ("2 ovos, 1 pão integral, 1 fruta")
--
-- Ficou de FORA de propósito (entra com migration nova quando o escopo
-- fechar): tabela de alimentos, gramas/porções estruturadas, calorias e
-- macros calculados, registro do que o aluno comeu.
--
-- Plano novo = novo registro; o antigo é desativado (ativo = false), então o
-- histórico de planos do aluno se mantém. Os itens são parte do plano.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "planos_nutricionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "observacoes" VARCHAR(2000),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_nutricionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_nutricionais_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plano_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "refeicao" VARCHAR(60) NOT NULL,
    "horario" TIME(0),
    "descricao" VARCHAR(2000) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_nutricionais_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (app e painel: "plano ativo do aluno"; também serve à FK)
CREATE INDEX "planos_nutricionais_aluno_id_ativo_idx"
    ON "planos_nutricionais"("aluno_id", "ativo");

-- CreateIndex (uma posição por plano; também serve à FK e já devolve as
-- refeições na ordem certa)
CREATE UNIQUE INDEX "planos_nutricionais_itens_plano_id_ordem_key"
    ON "planos_nutricionais_itens"("plano_id", "ordem");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno que tem planos (desativar, não apagar).
ALTER TABLE "planos_nutricionais"
    ADD CONSTRAINT "planos_nutricionais_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- CASCADE: o item é parte do plano.
ALTER TABLE "planos_nutricionais_itens"
    ADD CONSTRAINT "planos_nutricionais_itens_plano_id_fkey"
    FOREIGN KEY ("plano_id") REFERENCES "planos_nutricionais"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- textos obrigatórios não podem ser vazios; observação vazia = NULL.
ALTER TABLE "planos_nutricionais"
    ADD CONSTRAINT "planos_nutricionais_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

ALTER TABLE "planos_nutricionais"
    ADD CONSTRAINT "planos_nutricionais_observacoes_preenchida_chk"
    CHECK ("observacoes" IS NULL OR btrim("observacoes") <> '');

ALTER TABLE "planos_nutricionais_itens"
    ADD CONSTRAINT "planos_nutricionais_itens_refeicao_preenchida_chk"
    CHECK (btrim("refeicao") <> '');

ALTER TABLE "planos_nutricionais_itens"
    ADD CONSTRAINT "planos_nutricionais_itens_descricao_preenchida_chk"
    CHECK (btrim("descricao") <> '');

-- ordem começa em 1.
ALTER TABLE "planos_nutricionais_itens"
    ADD CONSTRAINT "planos_nutricionais_itens_ordem_positiva_chk"
    CHECK ("ordem" >= 1);

COMMIT;

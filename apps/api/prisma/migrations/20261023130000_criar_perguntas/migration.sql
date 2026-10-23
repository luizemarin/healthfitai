-- DB-008 · Questionários: tabela de perguntas de um modelo.
--
-- Cada pergunta pertence a um modelo (DB-007) e tem um tipo (tipo_pergunta,
-- DB-001). As colunas extras só valem para alguns tipos:
--
--   tipo              opcoes (json)        min / max          unidade
--   ----------------  -------------------  -----------------  ----------
--   texto, data       NULL                 NULL               NULL
--   numero            NULL                 opcionais          opcional (ex.: kg)
--   escala            NULL                 obrigatórios       opcional
--   escolha_unica,    lista de textos      NULL               NULL
--   multipla_escolha  (ex.: ["Sim","Não"])
--
-- exibir_evolucao: a resposta entra no gráfico de evolução. Só faz sentido
-- para respostas numéricas, por isso só vale para "numero" e "escala".
--
-- ordem: posição da pergunta no formulário (1, 2, 3...). Única dentro do
-- modelo. Para reordenar, a API faz tudo numa transação.
--
-- As regras da tabela acima são garantidas pelo banco com CHECK (no fim do
-- arquivo), para que um bug na API não grave pergunta inconsistente.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "perguntas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelo_id" UUID NOT NULL,
    "enunciado" VARCHAR(500) NOT NULL,
    "tipo" "tipo_pergunta" NOT NULL,
    "opcoes" JSONB,
    "ordem" INTEGER NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "exibir_evolucao" BOOLEAN NOT NULL DEFAULT false,
    "unidade" VARCHAR(20),
    "min" DECIMAL(10,2),
    "max" DECIMAL(10,2),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (uma posição por modelo; também serve à FK e já devolve as
-- perguntas na ordem certa)
CREATE UNIQUE INDEX "perguntas_modelo_id_ordem_key" ON "perguntas"("modelo_id", "ordem");

-- AddForeignKey
-- RESTRICT: não deixa apagar um modelo que tem perguntas
-- (a regra do sistema é desativar o modelo, não apagar).
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_modelo_id_fkey"
    FOREIGN KEY ("modelo_id") REFERENCES "modelos_questionario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- enunciado não pode ser vazio nem só espaços.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_enunciado_preenchido_chk"
    CHECK (btrim("enunciado") <> '');

-- ordem começa em 1.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_ordem_positiva_chk"
    CHECK ("ordem" >= 1);

-- perguntas de escolha precisam de uma lista com pelo menos uma opção;
-- as demais não têm opções.
-- O COALESCE é necessário: com opcoes NULL a comparação dá NULL, e um CHECK
-- que dá NULL é ACEITO pelo Postgres. Assim, NULL vira false e é barrado.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_opcoes_por_tipo_chk"
    CHECK (
        CASE
            WHEN "tipo" IN ('escolha_unica', 'multipla_escolha')
                THEN COALESCE(jsonb_typeof("opcoes") = 'array' AND "opcoes" <> '[]'::jsonb, false)
            ELSE "opcoes" IS NULL
        END
    );

-- min/max só para numero e escala; escala precisa dos dois.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_limites_por_tipo_chk"
    CHECK (
        CASE "tipo"
            WHEN 'escala' THEN "min" IS NOT NULL AND "max" IS NOT NULL
            WHEN 'numero' THEN true
            ELSE "min" IS NULL AND "max" IS NULL
        END
    );

-- quando os dois existem, min fica abaixo de max.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_min_menor_que_max_chk"
    CHECK ("min" IS NULL OR "max" IS NULL OR "min" < "max");

-- unidade só para numero e escala, e nunca texto vazio (sem unidade = NULL).
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_unidade_por_tipo_chk"
    CHECK (
        "unidade" IS NULL
        OR ("tipo" IN ('numero', 'escala') AND btrim("unidade") <> '')
    );

-- gráfico de evolução só com resposta numérica.
ALTER TABLE "perguntas"
    ADD CONSTRAINT "perguntas_evolucao_so_numerica_chk"
    CHECK (NOT "exibir_evolucao" OR "tipo" IN ('numero', 'escala'));

COMMIT;

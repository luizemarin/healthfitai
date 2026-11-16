-- DB-010 · Respostas: tabela de respostas (uma linha por pergunta respondida).
--
-- Cada resposta pertence a uma submissão (DB-009) e responde uma pergunta
-- (DB-008). O valor vai em UMA das três colunas, conforme o tipo da pergunta:
--
--   tipo da pergunta                  coluna         exemplo
--   --------------------------------  -------------  -------------------------
--   texto                             valor_texto    'Dor no joelho direito'
--   data                              valor_texto    '2026-10-25' (ISO)
--   numero, escala                    valor_numero   72.50
--   escolha_unica, multipla_escolha   valor_json     ["Sim"] / ["Corrida","Yoga"]
--
-- O banco garante que exatamente UMA coluna está preenchida (CHECK no fim).
-- Qual delas combina com o tipo da pergunta, e se a pergunta é do mesmo modelo
-- da submissão, a API valida (são regras entre tabelas).
--
-- Pergunta sem resposta = não existe linha (nunca uma linha com tudo NULL).
--
-- valor_numero usa DECIMAL(10,2), o mesmo formato de min/max das perguntas,
-- e é a coluna lida pelo gráfico de evolução.
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "respostas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submissao_id" UUID NOT NULL,
    "pergunta_id" UUID NOT NULL,
    "valor_texto" TEXT,
    "valor_numero" DECIMAL(10,2),
    "valor_json" JSONB,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (uma resposta por pergunta em cada submissão; também serve à FK
-- de submissao_id e devolve todas as respostas de uma submissão)
CREATE UNIQUE INDEX "respostas_submissao_id_pergunta_id_key"
    ON "respostas"("submissao_id", "pergunta_id");

-- CreateIndex (gráfico de evolução: "todos os valores da pergunta Peso";
-- também serve à FK de pergunta_id)
CREATE INDEX "respostas_pergunta_id_valor_numero_idx"
    ON "respostas"("pergunta_id", "valor_numero");

-- AddForeignKey
-- CASCADE: a resposta é parte da submissão, não vive sozinha. Se uma
-- submissão for apagada (ex.: descartar um rascunho), as respostas vão junto.
ALTER TABLE "respostas"
    ADD CONSTRAINT "respostas_submissao_id_fkey"
    FOREIGN KEY ("submissao_id") REFERENCES "submissoes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT: não deixa apagar uma pergunta que já foi respondida
-- (o histórico depende dela).
ALTER TABLE "respostas"
    ADD CONSTRAINT "respostas_pergunta_id_fkey"
    FOREIGN KEY ("pergunta_id") REFERENCES "perguntas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- exatamente um valor preenchido.
ALTER TABLE "respostas"
    ADD CONSTRAINT "respostas_um_valor_chk"
    CHECK (num_nonnulls("valor_texto", "valor_numero", "valor_json") = 1);

-- texto não pode ser vazio nem só espaços (sem resposta = sem linha).
ALTER TABLE "respostas"
    ADD CONSTRAINT "respostas_valor_texto_preenchido_chk"
    CHECK ("valor_texto" IS NULL OR btrim("valor_texto") <> '');

-- escolhas são uma lista com pelo menos um item.
ALTER TABLE "respostas"
    ADD CONSTRAINT "respostas_valor_json_lista_chk"
    CHECK (
        "valor_json" IS NULL
        OR (jsonb_typeof("valor_json") = 'array' AND "valor_json" <> '[]'::jsonb)
    );

COMMIT;

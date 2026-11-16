-- DB-017 · Medidas: tipos de medida e registros de medida do aluno.
--
-- Duas tabelas, na mesma ideia de poses_foto (DB-014) + fotos (DB-015):
--
--   tipos_medida     = O QUE se mede (ex.: Cintura em cm, Braço direito em cm,
--                      % de gordura em %). O profissional monta a lista dele.
--   registros_medida = o valor medido de um tipo, para um aluno, num dia.
--                      É daqui que sai cada curva do gráfico de evolução.
--
-- Dono do tipo (mesma regra dos modelos, DB-007, e das poses, DB-014):
--   profissional_id preenchido = tipo do profissional (só ele vê e edita)
--   profissional_id NULL       = tipo padrão do sistema (vem por seed, DB-021)
--
-- Remover tipo = desativar (ativo = false): some da tela de lançamento, mas
-- o histórico antigo continua apontando para ele e aparecendo no gráfico.
--
-- Registros seguem a regra "nada é sobrescrito": mediu de novo = novo
-- registro (sem atualizado_em). A unidade fica no tipo, não em cada registro:
-- todos os valores de uma curva estão sempre na mesma unidade.
--
-- Regra entre tabelas que a API valida: o tipo precisa ser do profissional
-- do aluno (ou padrão do sistema).
--
-- Tudo dentro de uma transação: ou cria as duas tabelas, ou nenhuma. Para
-- desfazer depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- ─── tipos_medida ───────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "tipos_medida" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID,
    "nome" VARCHAR(60) NOT NULL,
    "unidade" VARCHAR(20) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_medida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (painel: "meus tipos ativos"; também acha os padrão com
-- profissional_id IS NULL e serve à FK)
CREATE INDEX "tipos_medida_profissional_id_ativo_idx"
    ON "tipos_medida"("profissional_id", "ativo");

-- AddForeignKey
-- RESTRICT: não deixa apagar um profissional que tem tipos de medida.
ALTER TABLE "tipos_medida"
    ADD CONSTRAINT "tipos_medida_profissional_id_fkey"
    FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome e unidade não podem ser vazios nem só espaços.
ALTER TABLE "tipos_medida"
    ADD CONSTRAINT "tipos_medida_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

ALTER TABLE "tipos_medida"
    ADD CONSTRAINT "tipos_medida_unidade_preenchida_chk"
    CHECK (btrim("unidade") <> '');

-- ─── registros_medida ───────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "registros_medida" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "tipo_id" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_registro" DATE NOT NULL,
    "registrado_por" "papel" NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_medida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (gráfico: "cintura do aluno X ao longo do tempo"; também serve
-- à FK de aluno_id)
CREATE INDEX "registros_medida_aluno_id_tipo_id_data_registro_idx"
    ON "registros_medida"("aluno_id", "tipo_id", "data_registro");

-- CreateIndex (serve à FK de tipo_id)
CREATE INDEX "registros_medida_tipo_id_idx" ON "registros_medida"("tipo_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar aluno nem tipo que têm registros
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "registros_medida"
    ADD CONSTRAINT "registros_medida_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registros_medida"
    ADD CONSTRAINT "registros_medida_tipo_id_fkey"
    FOREIGN KEY ("tipo_id") REFERENCES "tipos_medida"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual: medida corporal não é zero nem negativa.
ALTER TABLE "registros_medida"
    ADD CONSTRAINT "registros_medida_valor_positivo_chk"
    CHECK ("valor" > 0);

COMMIT;

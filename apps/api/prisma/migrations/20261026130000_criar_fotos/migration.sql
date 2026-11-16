-- DB-015 · Fotos: tabela de fotos do aluno.
--
-- O arquivo NÃO fica no banco: fica no storage (Cloudflare R2, bucket
-- privado). Aqui guardamos só a chave do objeto no bucket; a API gera uma
-- URL assinada de curta duração quando alguém precisa ver a foto (BE-FOT-02).
--
--   storage_key    = chave da foto original (já comprimida e sem EXIF)
--   miniatura_key  = chave da miniatura usada na galeria. NULL até a
--                    miniatura ficar pronta (BE-FOT-03).
--   tamanho        = tamanho da original em bytes.
--   data_registro  = dia da foto. É por ela que a galeria agrupa e o
--                    comparador antes/depois escolhe as datas.
--   criado_por     = quem enviou: aluno (app) ou profissional (painel).
--                    Reaproveita o tipo "papel" do DB-001.
--
-- Nada é sobrescrito: tirar de novo = nova foto. Por isso não há
-- atualizado_em. A exclusão a pedido do titular (LGPD, LG-DIR-03) é feita
-- pela API, que também remove os arquivos do R2.
--
-- Regra entre tabelas que a API valida: a pose precisa ser do profissional
-- do aluno (ou padrão do sistema).
--
-- Tudo dentro de uma transação: ou cria tudo, ou não cria nada. Para desfazer
-- depois de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateTable
CREATE TABLE "fotos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "pose_id" UUID NOT NULL,
    "data_registro" DATE NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "miniatura_key" VARCHAR(500),
    "tamanho" INTEGER NOT NULL,
    "criado_por" "papel" NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (cada objeto do bucket pertence a uma foto só)
CREATE UNIQUE INDEX "fotos_storage_key_key" ON "fotos"("storage_key");

-- CreateIndex (idem para a miniatura; vários NULL são permitidos)
CREATE UNIQUE INDEX "fotos_miniatura_key_key" ON "fotos"("miniatura_key");

-- CreateIndex (galeria do aluno agrupada por data; também serve à FK de aluno_id)
CREATE INDEX "fotos_aluno_id_data_registro_idx"
    ON "fotos"("aluno_id", "data_registro");

-- CreateIndex (serve à FK de pose_id)
CREATE INDEX "fotos_pose_id_idx" ON "fotos"("pose_id");

-- AddForeignKey
-- RESTRICT: não deixa apagar aluno nem pose que têm fotos
-- (a regra do sistema é desativar, não apagar).
ALTER TABLE "fotos"
    ADD CONSTRAINT "fotos_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fotos"
    ADD CONSTRAINT "fotos_pose_id_fkey"
    FOREIGN KEY ("pose_id") REFERENCES "poses_foto"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- chaves não podem ser vazias nem só espaços.
ALTER TABLE "fotos"
    ADD CONSTRAINT "fotos_storage_key_preenchida_chk"
    CHECK (btrim("storage_key") <> '');

ALTER TABLE "fotos"
    ADD CONSTRAINT "fotos_miniatura_key_preenchida_chk"
    CHECK ("miniatura_key" IS NULL OR btrim("miniatura_key") <> '');

-- arquivo vazio não é foto.
ALTER TABLE "fotos"
    ADD CONSTRAINT "fotos_tamanho_positivo_chk"
    CHECK ("tamanho" > 0);

COMMIT;

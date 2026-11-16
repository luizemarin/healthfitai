-- DB-018 · Transversal (LGPD): responsáveis legais e consentimentos.
--
-- Duas tabelas:
--
--   responsaveis    = responsável legal de um aluno MENOR (LG-MEN-02).
--                     Nome, e-mail, telefone e parentesco são obrigatórios.
--                     Não guardamos CPF (minimização de dados).
--   consentimentos  = cada aceite de termo/consentimento, com a versão do
--                     termo, a data, o IP e QUEM concedeu (LG-CON-01).
--
-- Responsável
--   Um aluno pode ter mais de um (ex.: mãe e pai). Quem é menor a API sabe
--   pela data_nascimento do aluno (DB-004); o banco não guarda idade.
--   Verificação (LG-MEN-04), as duas datas começam NULL:
--     email_verificado_em               -> o responsável clicou no link do e-mail
--     confirmado_pelo_profissional_em   -> o profissional declarou "contrato
--                                          assinado por este responsável"
--
-- Consentimento
--   O titular dos dados é sempre o ALUNO, por isso a tabela aponta para
--   aluno_id (e não usuario_id): o responsável concede ANTES de o aluno ter
--   conta (LG-MEN-03), então o aluno ainda não tem usuario_id nessa hora.
--
--   concedido_por:
--     titular     -> o próprio aluno (maior de idade, ou a ciência do adolescente)
--     responsavel -> o responsável legal; responsavel_id é OBRIGATÓRIO
--
--   tipo: saude, fotos, termos, ciencia_adolescente. O tipo "ia" entra depois
--   na DB-027 (ALTER TYPE ... ADD VALUE), sem tabela nova.
--
--   "Nada é sobrescrito":
--     nova versão do termo -> novo registro (o antigo fica no histórico, LG-CON-03)
--     revogar              -> só preenche revogado_em (LG-CON-04)
--   Consentimento ATIVO = revogado_em IS NULL. Por isso não há atualizado_em.
--
-- Regra entre tabelas que a API valida: o responsável precisa ser do mesmo
-- aluno do consentimento.
--
-- Tudo dentro de uma transação: ou cria tudo, ou nada. Para desfazer depois
-- de aplicada, ver down.sql nesta mesma pasta.

BEGIN;

-- CreateEnum
CREATE TYPE "tipo_consentimento" AS ENUM ('saude', 'fotos', 'termos', 'ciencia_adolescente');

-- CreateEnum (quem age em nome do titular; também usado em
-- solicitacoes_titular, DB-019)
CREATE TYPE "agente_titular" AS ENUM ('titular', 'responsavel');

-- ─── responsaveis ───────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "responsaveis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "telefone" VARCHAR(11) NOT NULL,
    "parentesco" VARCHAR(40) NOT NULL,
    "email_verificado_em" TIMESTAMPTZ(3),
    "confirmado_pelo_profissional_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (mesmo e-mail não se repete no mesmo aluno; também lista os
-- responsáveis do aluno e serve à FK)
CREATE UNIQUE INDEX "responsaveis_aluno_id_email_key"
    ON "responsaveis"("aluno_id", "email");

-- AddForeignKey
-- RESTRICT: não deixa apagar um aluno que tem responsável cadastrado.
ALTER TABLE "responsaveis"
    ADD CONSTRAINT "responsaveis_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual (o Prisma não modela CHECK, mas também não o remove):
-- nome e parentesco não podem ser vazios.
ALTER TABLE "responsaveis"
    ADD CONSTRAINT "responsaveis_nome_preenchido_chk"
    CHECK (btrim("nome") <> '');

ALTER TABLE "responsaveis"
    ADD CONSTRAINT "responsaveis_parentesco_preenchido_chk"
    CHECK (btrim("parentesco") <> '');

-- e-mail normalizado (minúsculo, sem espaços nas pontas), igual a alunos.
ALTER TABLE "responsaveis"
    ADD CONSTRAINT "responsaveis_email_normalizado_chk"
    CHECK ("email" = lower(btrim("email")) AND "email" <> '');

-- telefone só com dígitos: DDD + número (10 ou 11 dígitos), igual a alunos.
ALTER TABLE "responsaveis"
    ADD CONSTRAINT "responsaveis_telefone_digitos_chk"
    CHECK ("telefone" ~ '^[0-9]{10,11}$');

-- ─── consentimentos ─────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "tipo" "tipo_consentimento" NOT NULL,
    "concedido_por" "agente_titular" NOT NULL,
    "responsavel_id" UUID,
    "versao_termo" VARCHAR(20) NOT NULL,
    "aceito_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogado_em" TIMESTAMPTZ(3),
    "ip" INET NOT NULL,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (a API pergunta "o aluno X tem consentimento de saúde ativo?"
-- antes de liberar anamnese/fotos; também serve à FK de aluno_id)
CREATE INDEX "consentimentos_aluno_id_tipo_idx"
    ON "consentimentos"("aluno_id", "tipo");

-- CreateIndex (serve à FK de responsavel_id)
CREATE INDEX "consentimentos_responsavel_id_idx"
    ON "consentimentos"("responsavel_id");

-- AddForeignKey
-- RESTRICT: consentimento é prova legal; não deixa apagar aluno nem
-- responsável que têm consentimentos registrados.
ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_aluno_id_fkey"
    FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_responsavel_id_fkey"
    FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL manual:
-- concedido pelo responsável <=> responsavel_id preenchido.
-- (titular com responsavel_id, ou responsável sem ele, é barrado.)
ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_responsavel_coerente_chk"
    CHECK (("concedido_por" = 'responsavel') = ("responsavel_id" IS NOT NULL));

-- a ciência do adolescente é registrada por ele mesmo (LG-MEN-05); ela não
-- substitui o consentimento do responsável.
ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_ciencia_pelo_titular_chk"
    CHECK ("tipo" <> 'ciencia_adolescente' OR "concedido_por" = 'titular');

-- versão do termo não pode ser vazia (ex.: "1.0", "2026-10").
ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_versao_preenchida_chk"
    CHECK (btrim("versao_termo") <> '');

-- não se revoga antes de aceitar.
ALTER TABLE "consentimentos"
    ADD CONSTRAINT "consentimentos_revogado_apos_aceite_chk"
    CHECK ("revogado_em" IS NULL OR "revogado_em" >= "aceito_em");

COMMIT;

-- DB-021 · Seed: modelos e poses padrão do sistema.
--
-- O que entra (tudo com profissional_id NULL = "padrão do sistema, sem dono"):
--   1. Anamnese masculina   (modelos_questionario, tipo anamnese, sexo_alvo masculino)
--   2. Anamnese feminina    (idem, sexo_alvo feminino: perguntas comuns + 4 extras)
--   3. Avaliação postural   (tipo avaliacao, 5 testes: Postural Estática,
--                            Trendelenburg, Single Leg Squat, Wall Angel, OHSA)
--   4. Poses de foto        (poses_foto: frente, perfil, costas)
-- Esses registros servem de BASE: a API duplica/copia para o profissional,
-- que então edita a cópia dele. O padrão nunca é editado direto.
--
-- Por que fica FORA das migrations (prisma/seeds e não prisma/migrations):
-- migration muda a ESTRUTURA do banco; seed coloca DADOS iniciais. Separados,
-- dá para rodar/desfazer um sem mexer no outro.
--
-- IDEMPOTENTE (pode rodar quantas vezes quiser, o resultado é o mesmo):
--   - modelos e poses têm id FIXO, escrito aqui; se o id já existe, pula
--     (ON CONFLICT (id) DO NOTHING).
--   - perguntas usam o único (modelo_id, ordem) do DB-008; se a posição já
--     existe no modelo, pula (ON CONFLICT (modelo_id, ordem) DO NOTHING).
-- "Pula" e não "atualiza" de propósito: nada é sobrescrito. Mudar o conteúdo
-- de um padrão = novo seed com novos ids (e desativar o antigo).
--
-- Rodar (a partir de apps/api):   npm run db:seed
-- Desfazer:                       npm run db:seed:rollback   (ver down.sql)
--
-- Tudo dentro de uma transação: ou entra tudo, ou nada.

BEGIN;

-- ─── 1 e 2 · Anamnese masculina e feminina ──────────────────────────────────

INSERT INTO "modelos_questionario" ("id", "profissional_id", "tipo", "nome", "sexo_alvo")
VALUES
    ('00000000-0000-4000-a000-000000000001', NULL, 'anamnese', 'Anamnese masculina', 'masculino'),
    ('00000000-0000-4000-a000-000000000002', NULL, 'anamnese', 'Anamnese feminina', 'feminino')
ON CONFLICT ("id") DO NOTHING;

-- Perguntas comuns aos dois modelos (escritas uma vez só e inseridas nos dois
-- pelo CROSS JOIN). Colunas: ordem, enunciado, tipo, opcoes, obrigatoria,
-- exibir_evolucao, unidade, min, max.
INSERT INTO "perguntas"
    ("modelo_id", "ordem", "enunciado", "tipo", "opcoes", "obrigatoria",
     "exibir_evolucao", "unidade", "min", "max")
SELECT m.id, p.ordem, p.enunciado, p.tipo::"tipo_pergunta", p.opcoes::jsonb,
       p.obrigatoria, p.exibir_evolucao, p.unidade, p.min, p.max
FROM (VALUES
        ('00000000-0000-4000-a000-000000000001'::uuid),
        ('00000000-0000-4000-a000-000000000002'::uuid)
     ) AS m(id)
CROSS JOIN (VALUES
    (1,  'Qual é o seu principal objetivo?', 'escolha_unica',
         '["Emagrecimento","Ganho de massa muscular","Condicionamento","Saúde e qualidade de vida","Reabilitação","Performance esportiva"]',
         true,  false, NULL, NULL, NULL),
    (2,  'Peso atual', 'numero', NULL, true, true, 'kg', 20, 400),
    (3,  'Altura', 'numero', NULL, true, false, 'cm', 50, 250),
    (4,  'Pratica atividade física atualmente?', 'escolha_unica', '["Sim","Não"]',
         true,  false, NULL, NULL, NULL),
    (5,  'Quantos dias por semana você pode treinar?', 'numero', NULL,
         true,  false, 'dias', 1, 7),
    (6,  'Tem alguma destas condições de saúde?', 'multipla_escolha',
         '["Hipertensão","Diabetes","Doença cardíaca","Asma","Colesterol alto","Nenhuma","Outra"]',
         true,  false, NULL, NULL, NULL),
    (7,  'Usa algum medicamento de forma contínua? Qual?', 'texto', NULL,
         false, false, NULL, NULL, NULL),
    (8,  'Já teve lesões ou cirurgias? Quais e quando?', 'texto', NULL,
         false, false, NULL, NULL, NULL),
    (9,  'Sente dor em alguma destas regiões?', 'multipla_escolha',
         '["Cervical","Ombro","Lombar","Quadril","Joelho","Tornozelo","Nenhuma"]',
         true,  false, NULL, NULL, NULL),
    (10, 'Quantas horas dorme por noite, em média?', 'numero', NULL,
         false, false, 'h', 0, 24),
    (11, 'Como avalia a qualidade do seu sono?', 'escala', NULL,
         false, true,  NULL, 1, 5),
    (12, 'Como avalia o seu nível de estresse?', 'escala', NULL,
         false, true,  NULL, 1, 10),
    (13, 'É fumante?', 'escolha_unica', '["Sim","Não","Ex-fumante"]',
         true,  false, NULL, NULL, NULL),
    (14, 'Consome bebida alcoólica?', 'escolha_unica',
         '["Não","Socialmente","Semanalmente","Diariamente"]',
         true,  false, NULL, NULL, NULL),
    (15, 'Algo mais que o seu profissional deva saber?', 'texto', NULL,
         false, false, NULL, NULL, NULL)
) AS p(ordem, enunciado, tipo, opcoes, obrigatoria, exibir_evolucao, unidade, min, max)
ON CONFLICT ("modelo_id", "ordem") DO NOTHING;

-- Perguntas extras só da anamnese feminina (continuam a numeração: 16 a 19).
INSERT INTO "perguntas"
    ("modelo_id", "ordem", "enunciado", "tipo", "opcoes", "obrigatoria")
VALUES
    ('00000000-0000-4000-a000-000000000002', 16, 'O seu ciclo menstrual é regular?',
     'escolha_unica', '["Sim","Não","Não se aplica"]', true),
    ('00000000-0000-4000-a000-000000000002', 17, 'Usa anticoncepcional ou terapia hormonal?',
     'escolha_unica', '["Sim","Não"]', true),
    ('00000000-0000-4000-a000-000000000002', 18, 'Está gestante ou teve gestação nos últimos 12 meses?',
     'escolha_unica', '["Sim","Não"]', true),
    ('00000000-0000-4000-a000-000000000002', 19, 'Está na menopausa?',
     'escolha_unica', '["Sim","Não","Não sei"]', true)
ON CONFLICT ("modelo_id", "ordem") DO NOTHING;

-- ─── 3 · Avaliação postural (5 testes) ──────────────────────────────────────
-- Preenchida pelo PROFISSIONAL. Vale para qualquer sexo (sexo_alvo NULL).
-- Cada teste tem perguntas de "o que foi observado" (escolha) e o último
-- campo é texto livre para observações.

INSERT INTO "modelos_questionario" ("id", "profissional_id", "tipo", "nome", "sexo_alvo")
VALUES ('00000000-0000-4000-a000-000000000003', NULL, 'avaliacao', 'Avaliação postural', NULL)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "perguntas"
    ("modelo_id", "ordem", "enunciado", "tipo", "opcoes", "obrigatoria")
SELECT '00000000-0000-4000-a000-000000000003'::uuid, p.ordem, p.enunciado,
       p.tipo::"tipo_pergunta", p.opcoes::jsonb, p.obrigatoria
FROM (VALUES
    -- Teste 1 · Avaliação Postural Estática
    (1,  'Postural estática · vista anterior', 'multipla_escolha',
         '["Ombros desnivelados","Pelve desnivelada","Joelhos valgos","Joelhos varos","Pés pronados","Pés supinados","Sem alterações"]',
         true),
    (2,  'Postural estática · vista lateral', 'multipla_escolha',
         '["Cabeça anteriorizada","Ombros protusos","Hipercifose torácica","Hiperlordose lombar","Retificação lombar","Joelhos hiperestendidos","Sem alterações"]',
         true),
    (3,  'Postural estática · vista posterior', 'multipla_escolha',
         '["Escápulas aladas","Escoliose aparente","Calcâneos valgos","Calcâneos varos","Sem alterações"]',
         true),
    -- Teste 2 · Trendelenburg
    (4,  'Trendelenburg · apoio na perna direita', 'escolha_unica', '["Negativo","Positivo"]', true),
    (5,  'Trendelenburg · apoio na perna esquerda', 'escolha_unica', '["Negativo","Positivo"]', true),
    -- Teste 3 · Single Leg Squat
    (6,  'Single Leg Squat · perna direita', 'multipla_escolha',
         '["Valgo dinâmico do joelho","Queda da pelve","Rotação do tronco","Inclinação do tronco","Perda de equilíbrio","Sem compensações"]',
         true),
    (7,  'Single Leg Squat · perna esquerda', 'multipla_escolha',
         '["Valgo dinâmico do joelho","Queda da pelve","Rotação do tronco","Inclinação do tronco","Perda de equilíbrio","Sem compensações"]',
         true),
    -- Teste 4 · Wall Angel
    (8,  'Wall Angel · resultado', 'escolha_unica',
         '["Completa sem compensações","Completa com compensações","Não completa"]',
         true),
    (9,  'Wall Angel · compensações', 'multipla_escolha',
         '["Punhos/cotovelos perdem contato com a parede","Hiperlordose lombar","Cabeça anteriorizada","Elevação dos ombros","Sem compensações"]',
         true),
    -- Teste 5 · OHSA (Overhead Squat Assessment)
    (10, 'OHSA · vista anterior', 'multipla_escolha',
         '["Pés rodam para fora","Joelhos em valgo","Joelhos em varo","Transferência de peso assimétrica","Sem compensações"]',
         true),
    (11, 'OHSA · vista lateral', 'multipla_escolha',
         '["Inclinação excessiva do tronco","Hiperlordose lombar","Braços caem à frente","Calcanhares saem do chão","Sem compensações"]',
         true),
    -- Fechamento
    (12, 'Observações gerais da avaliação', 'texto', NULL, false)
) AS p(ordem, enunciado, tipo, opcoes, obrigatoria)
ON CONFLICT ("modelo_id", "ordem") DO NOTHING;

-- ─── 4 · Poses de foto padrão ───────────────────────────────────────────────

INSERT INTO "poses_foto" ("id", "profissional_id", "nome", "ordem")
VALUES
    ('00000000-0000-4000-b000-000000000001', NULL, 'Frente',  1),
    ('00000000-0000-4000-b000-000000000002', NULL, 'Perfil',  2),
    ('00000000-0000-4000-b000-000000000003', NULL, 'Costas',  3)
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- DB-021 · Rollback do seed: remove os modelos e poses padrão inseridos pelo
-- seed.sql desta pasta. A estrutura (tabelas) NÃO é tocada.
--
-- Rodar (a partir de apps/api):   npm run db:seed:rollback
-- Depois, para colocar de novo:   npm run db:seed
--
-- Apaga SÓ o que o seed criou: os ids fixos abaixo (e as perguntas desses
-- modelos). Modelos/poses dos profissionais ficam intactos.
--
-- PROTEÇÃO: se algum padrão já está em uso (ex.: uma submissão aponta para a
-- avaliação postural, ou uma foto aponta para a pose "Frente"), a FK RESTRICT
-- barra o DELETE e a transação inteira é desfeita: nada é apagado pela metade.
-- Nesse caso, o certo é DESATIVAR o padrão (ativo/ativa = false), não apagar.
--
-- ORDEM: perguntas antes dos modelos (perguntas depende de modelos).

BEGIN;

DELETE FROM "perguntas"
WHERE "modelo_id" IN (
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003'
);

DELETE FROM "modelos_questionario"
WHERE "id" IN (
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003'
);

DELETE FROM "poses_foto"
WHERE "id" IN (
    '00000000-0000-4000-b000-000000000001',
    '00000000-0000-4000-b000-000000000002',
    '00000000-0000-4000-b000-000000000003'
);

COMMIT;

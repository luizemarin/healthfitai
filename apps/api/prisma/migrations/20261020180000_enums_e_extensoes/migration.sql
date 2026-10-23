-- DB-001 · Fundação: enums
-- Tudo dentro de uma transação: se qualquer comando falhar, nada fica criado.
BEGIN;

-- CreateEnum
CREATE TYPE "papel" AS ENUM ('profissional', 'aluno');

-- CreateEnum
CREATE TYPE "tipo_modelo" AS ENUM ('anamnese', 'avaliacao', 'feedback');

-- CreateEnum
CREATE TYPE "tipo_pergunta" AS ENUM ('texto', 'numero', 'escala', 'escolha_unica', 'multipla_escolha', 'data');

-- CreateEnum
CREATE TYPE "status_feedback" AS ENUM ('agendado', 'enviado', 'respondido', 'atrasado');

-- CreateEnum
CREATE TYPE "recorrencia" AS ENUM ('semanal', 'quinzenal', 'mensal', 'avulso');

COMMIT;

import type { Sexo } from './alunos-api';
import type { ApiErrorDetail } from '../../api/api-error';

/**
 * Validação do formulário de aluno — mesmas regras do back (apps/api/src/modules/alunos/alunos.schemas.ts).
 * Roda ao salvar; o back valida de novo e, se recusar, o erro dele volta para o campo certo
 * (errosDaApi). Mudou uma regra no back? Ajuste aqui também.
 *
 *   nome            obrigatório, 2 a 120 caracteres
 *   sexo            obrigatório, masculino | feminino
 *   dataNascimento  obrigatória, não pode ser no futuro nem de mais de 120 anos atrás
 *   email           opcional, formato de e-mail, até 254 caracteres
 *   telefone        opcional, DDD + número (10 ou 11 dígitos), com ou sem máscara
 */
export interface AlunoForm {
  nome: string;
  sexo: Sexo | '';
  dataNascimento: string;
  email: string;
  telefone: string;
}

export type CampoAluno = keyof AlunoForm;
export type ErrosAluno = { [Campo in CampoAluno]?: string | undefined };

export const CAMPOS_ALUNO: readonly CampoAluno[] = [
  'nome',
  'sexo',
  'dataNascimento',
  'email',
  'telefone',
];

export const IDADE_MAXIMA = 120;

/** Hoje em AAAA-MM-DD (UTC, igual ao back). Datas ISO podem ser comparadas como texto. */
export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dataMinimaNascimento(): string {
  const data = new Date();
  data.setUTCFullYear(data.getUTCFullYear() - IDADE_MAXIMA);
  return data.toISOString().slice(0, 10);
}

const somenteDigitos = (valor: string): string => valor.replace(/\D/g, '');

// Simples de propósito: pega erros de digitação. A palavra final é do back.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarNome(valor: string): string | undefined {
  const nome = valor.trim();
  if (!nome) return 'O nome é obrigatório.';
  if (nome.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
  if (nome.length > 120) return 'O nome deve ter no máximo 120 caracteres.';
  return undefined;
}

function validarDataNascimento(valor: string): string | undefined {
  if (!valor) return 'A data de nascimento é obrigatória.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor))) {
    return 'Informe uma data de nascimento válida.';
  }
  if (valor > hoje()) return 'A data de nascimento não pode ser no futuro.';
  if (valor < dataMinimaNascimento()) {
    return `A data de nascimento não pode ser de mais de ${String(IDADE_MAXIMA)} anos atrás.`;
  }
  return undefined;
}

function validarEmail(valor: string): string | undefined {
  const email = valor.trim();
  if (!email) return undefined;
  if (email.length > 254) return 'O e-mail deve ter no máximo 254 caracteres.';
  if (!EMAIL_REGEX.test(email)) return 'E-mail inválido.';
  return undefined;
}

function validarTelefone(valor: string): string | undefined {
  if (!valor.trim()) return undefined;
  const digitos = somenteDigitos(valor).length;
  if (digitos < 10 || digitos > 11) return 'O telefone deve ter DDD + número (10 ou 11 dígitos).';
  return undefined;
}

/** Valida tudo de uma vez; objeto vazio = pode enviar. */
export function validarAluno(form: AlunoForm): ErrosAluno {
  const erros: ErrosAluno = {
    nome: validarNome(form.nome),
    sexo: form.sexo ? undefined : 'O sexo é obrigatório.',
    dataNascimento: validarDataNascimento(form.dataNascimento),
    email: validarEmail(form.email),
    telefone: validarTelefone(form.telefone),
  };
  // Remove os campos sem erro.
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro)) as ErrosAluno;
}

/**
 * Separa os erros de validação da API ("body.email") em erros por campo do formulário
 * e o que não é de nenhum campo (vai para o aviso).
 */
export function errosDaApi(details: readonly ApiErrorDetail[]): {
  porCampo: ErrosAluno;
  outros: string[];
} {
  const porCampo: ErrosAluno = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const campo = field.replace(/^body\./, '') as CampoAluno;
    if (CAMPOS_ALUNO.includes(campo)) {
      porCampo[campo] ??= message;
    } else {
      outros.push(message);
    }
  });

  return { porCampo, outros };
}

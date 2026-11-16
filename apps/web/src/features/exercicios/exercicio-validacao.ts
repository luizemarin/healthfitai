import type { ApiErrorDetail } from '../../api/api-error';

/**
 * Validação do formulário de exercício — mesmas regras e mensagens do back
 * (apps/api/src/modules/exercicios/exercicios.schemas.ts). Roda ao salvar; o back valida
 * de novo e, se recusar, o erro dele volta para o campo certo (errosDaApi).
 * Mudou uma regra no back? Ajuste aqui também.
 *
 *   nome           obrigatório, 2 a 120 caracteres
 *   grupoMuscular  obrigatório, até 60 caracteres
 *   descricao      opcional, até 2000 caracteres
 *   midiaUrl       opcional, começa com https://, sem espaços, até 500 caracteres
 */
export interface ExercicioForm {
  nome: string;
  grupoMuscular: string;
  descricao: string;
  midiaUrl: string;
}

export type CampoExercicio = keyof ExercicioForm;
export type ErrosExercicio = { [Campo in CampoExercicio]?: string | undefined };

export const LIMITES = { nome: 120, grupoMuscular: 60, descricao: 2000, midiaUrl: 500 } as const;

const CAMPOS: readonly CampoExercicio[] = ['nome', 'grupoMuscular', 'descricao', 'midiaUrl'];

function validarNome(valor: string): string | undefined {
  const nome = valor.trim();
  if (!nome) return 'O nome do exercício é obrigatório.';
  if (nome.length < 2) return 'O nome do exercício deve ter pelo menos 2 caracteres.';
  if (nome.length > LIMITES.nome) {
    return `O nome do exercício deve ter no máximo ${String(LIMITES.nome)} caracteres.`;
  }
  return undefined;
}

function validarGrupo(valor: string): string | undefined {
  const grupo = valor.trim();
  if (!grupo) return 'O grupo muscular é obrigatório.';
  if (grupo.length > LIMITES.grupoMuscular) {
    return `O grupo muscular deve ter no máximo ${String(LIMITES.grupoMuscular)} caracteres.`;
  }
  return undefined;
}

function validarDescricao(valor: string): string | undefined {
  if (valor.trim().length > LIMITES.descricao) {
    return `A descrição deve ter no máximo ${String(LIMITES.descricao)} caracteres.`;
  }
  return undefined;
}

function validarMidia(valor: string): string | undefined {
  const link = valor.trim();
  if (!link) return undefined;
  if (link.length > LIMITES.midiaUrl) {
    return `O link da mídia deve ter no máximo ${String(LIMITES.midiaUrl)} caracteres.`;
  }
  if (!/^https:\/\/\S+$/.test(link)) {
    return 'O link da mídia deve começar com https:// e não pode ter espaços.';
  }
  return undefined;
}

/** Valida tudo de uma vez; objeto vazio = pode enviar. */
export function validarExercicio(form: ExercicioForm): ErrosExercicio {
  const erros: ErrosExercicio = {
    nome: validarNome(form.nome),
    grupoMuscular: validarGrupo(form.grupoMuscular),
    descricao: validarDescricao(form.descricao),
    midiaUrl: validarMidia(form.midiaUrl),
  };
  // Remove os campos sem erro.
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro)) as ErrosExercicio;
}

/**
 * Separa os erros de validação da API ("body.nome") em erros por campo do formulário
 * e o que não é de nenhum campo (vai para o aviso).
 */
export function errosDaApi(details: readonly ApiErrorDetail[]): {
  porCampo: ErrosExercicio;
  outros: string[];
} {
  const porCampo: ErrosExercicio = {};
  const outros: string[] = [];

  details.forEach(({ field, message }) => {
    const campo = field.replace(/^body\./, '') as CampoExercicio;
    if (CAMPOS.includes(campo)) {
      porCampo[campo] ??= message;
    } else {
      outros.push(message);
    }
  });

  return { porCampo, outros };
}

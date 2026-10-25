import type { ReactElement, ReactNode } from 'react';

interface FieldProps {
  /** id do input/select: liga o label, a dica e o erro ao campo. */
  id: string;
  label: string;
  required?: boolean;
  /** Dica curta abaixo do campo (ex.: formato esperado). */
  hint?: string | undefined;
  error?: string | undefined;
  /** Recebe os atributos de acessibilidade para repassar ao input. */
  children: (a11y: FieldA11y) => ReactNode;
}

export interface FieldA11y {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  'aria-required': boolean;
}

/**
 * Campo de formulário padrão: label (com * se obrigatório), dica e mensagem de erro.
 *
 *   <Field id="nome" label="Nome" required error={errors.nome}>
 *     {(a11y) => <input {...a11y} className="hf-input" />}
 *   </Field>
 */
export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: FieldProps): ReactElement {
  // Com erro, a mensagem de erro substitui a dica.
  const hintId = hint && !error ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="font-semibold">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required,
      })}
      {error && (
        <p id={errorId} className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      {hintId && (
        <p id={hintId} className="m-0 text-sm text-foreground-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

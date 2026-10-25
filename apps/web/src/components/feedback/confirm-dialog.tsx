import { useEffect, useRef } from 'react';

import type { ReactElement } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Ação que desfaz algo (revogar, desativar): botão em destaque de perigo. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação antes de uma ação que não dá para desfazer (ex.: revogar convite).
 * Usa o <dialog> nativo: prende o foco, fecha no Esc e escurece o fundo sem biblioteca.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      className="w-[min(92vw,440px)] rounded-md border border-border bg-surface p-lg text-foreground backdrop:bg-[rgb(0_0_0/60%)]"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title" className="text-lg md:text-lg">
        {title}
      </h2>
      <p className="m-0 text-foreground-muted">{message}</p>
      <div className="mt-lg flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <button
          type="button"
          className="hf-button hf-button--secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={danger ? 'hf-button hf-button--danger' : 'hf-button'}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Aguarde…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

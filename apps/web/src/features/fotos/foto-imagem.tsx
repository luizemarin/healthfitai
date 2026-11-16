import { useState } from 'react';

import type { ReactElement } from 'react';

interface FotoImagemProps {
  src: string;
  alt: string;
  className?: string | undefined;
  /** Busca a lista de novo (URLs novas). Mostra o botão "Recarregar fotos" no aviso. */
  onRecarregar?: (() => void) | undefined;
}

/**
 * Foto vinda do storage. As URLs são assinadas e valem poucos minutos (BE-FOT-04):
 * se a imagem não abrir (URL expirada, storage fora), mostra um aviso amigável no lugar
 * da imagem quebrada, com a opção de buscar URLs novas.
 */
export function FotoImagem({ src, alt, className, onRecarregar }: FotoImagemProps): ReactElement {
  // Guarda QUAL url falhou: com uma url nova (após recarregar), tenta exibir de novo.
  const [urlComErro, setUrlComErro] = useState<string | null>(null);

  if (urlComErro === src) {
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-sm rounded-sm border border-border bg-background p-md text-center text-sm text-foreground-muted ${className ?? ''}`}
      >
        <span>Não foi possível exibir a foto.</span>
        {onRecarregar && (
          <button type="button" className="hf-button hf-button--secondary" onClick={onRecarregar}>
            Recarregar fotos
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`rounded-sm bg-background object-cover ${className ?? ''}`}
      onError={() => setUrlComErro(src)}
    />
  );
}

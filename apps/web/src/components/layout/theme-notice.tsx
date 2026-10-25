import { useState } from 'react';

import { isThemeFallback } from '../../theme/theme-status';

import type { CSSProperties, ReactElement } from 'react';

/*
 * Estilo inline de propósito: este aviso aparece justamente quando o CSS/cores podem
 * não ter carregado, então não pode depender deles. Cores do sistema = sempre legíveis.
 */
const style: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px 16px',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid GrayText',
  background: 'Canvas',
  color: 'CanvasText',
  textAlign: 'center',
};

const buttonStyle: CSSProperties = {
  minHeight: '44px',
  padding: '0 16px',
  border: '1px solid GrayText',
  borderRadius: '8px',
  background: 'ButtonFace',
  color: 'ButtonText',
  cursor: 'pointer',
};

/** Aviso amigável quando as cores do painel não carregaram. Não bloqueia o uso. */
export function ThemeNotice(): ReactElement | null {
  // Lido uma vez: o tema é aplicado antes do React subir (main.tsx) e não muda depois.
  const [visible, setVisible] = useState(isThemeFallback);

  if (!visible) {
    return null;
  }

  return (
    <div role="status" style={style}>
      <span>
        Não conseguimos carregar as cores do painel. Você pode continuar usando normalmente.
      </span>
      <span style={{ display: 'flex', gap: '8px' }}>
        <button type="button" style={buttonStyle} onClick={() => window.location.reload()}>
          Recarregar
        </button>
        <button type="button" style={buttonStyle} onClick={() => setVisible(false)}>
          Fechar
        </button>
      </span>
    </div>
  );
}

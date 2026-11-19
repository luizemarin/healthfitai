import { useEffect, useState } from 'react';

/**
 * Hora atual (ms), atualizada a cada segundo enquanto `ativo`.
 *
 * Os tempos da tela são sempre "agora − início", nunca um contador somado a cada segundo: com o app
 * em segundo plano o iOS pausa o JavaScript e o Android nem sempre; ao voltar, o tempo está certo
 * nos dois.
 */
export function useAgora(ativo = true): number {
  const [agora, setAgora] = useState(Date.now);

  useEffect(() => {
    if (!ativo) {
      return undefined;
    }
    const atualizar = (): void => {
      setAgora(Date.now());
    };
    // Atualiza logo ao (re)ativar (ex.: o timer volta a correr) e depois a cada segundo.
    const logo = setTimeout(atualizar, 0);
    const intervalo = setInterval(atualizar, 1000);
    return () => {
      clearTimeout(logo);
      clearInterval(intervalo);
    };
  }, [ativo]);

  return agora;
}

/** Segundos inteiros entre dois instantes (ms). Nunca negativo. */
export function segundosEntre(inicio: number, fim: number): number {
  return Math.max(0, Math.floor((fim - inicio) / 1000));
}

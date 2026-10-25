/** Classes comuns dos estados (carregando, vazio, erro), para os três terem o mesmo visual. */
export const stateClasses = {
  root: 'mx-auto flex max-w-[480px] flex-col items-center gap-3 py-12 text-center',
  title: 'm-0',
  message: 'm-0 text-foreground-muted',
  // Celular: botões na largura toda (mais fáceis de tocar); do tablet em diante, lado a lado.
  actions: 'mt-sm flex w-full flex-wrap justify-center gap-3 [&>*]:w-full md:[&>*]:w-auto',
} as const;

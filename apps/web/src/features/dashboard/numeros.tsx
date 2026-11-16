import type { ReactElement } from 'react';

/** Linha de números (rótulo + valor): 2 colunas no celular, 4 do tablet em diante. */
export function Numeros({ itens }: { itens: { label: string; valor: string }[] }): ReactElement {
  return (
    <dl className="m-0 grid grid-cols-2 gap-sm md:grid-cols-4">
      {itens.map(({ label, valor }) => (
        <div key={label} className="flex flex-col">
          <dt className="text-sm text-foreground-muted">{label}</dt>
          <dd className="m-0 font-heading text-lg font-semibold tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

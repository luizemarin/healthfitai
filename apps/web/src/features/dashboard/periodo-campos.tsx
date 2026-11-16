import { Field } from '../../components/form/field';
import { formatarData } from '../alunos/aluno-formato';
import { hojeLocal } from '../avaliacoes/avaliacao-data';

import type { ReactElement } from 'react';

import type { FiltroPeriodo, Periodo } from './dashboard-api';

interface PeriodoCamposProps {
  valor: FiltroPeriodo;
  /** Erros do back por campo (ver errosDoPeriodo). */
  erros: { de?: string | undefined; ate?: string | undefined };
  onChange: (campo: 'de' | 'ate', valor: string) => void;
}

/** Campos "De" e "Até" do período. Vazios = últimos 30 dias (padrão do back). */
export function PeriodoCampos({ valor, erros, onChange }: PeriodoCamposProps): ReactElement {
  const hoje = hojeLocal();

  return (
    <>
      <Field id="periodo-de" label="De" error={erros.de}>
        {(a11y) => (
          <input
            {...a11y}
            type="date"
            className="hf-input"
            max={hoje}
            value={valor.de ?? ''}
            onChange={(event) => onChange('de', event.target.value)}
          />
        )}
      </Field>
      <Field id="periodo-ate" label="Até" error={erros.ate}>
        {(a11y) => (
          <input
            {...a11y}
            type="date"
            className="hf-input"
            max={hoje}
            value={valor.ate ?? ''}
            onChange={(event) => onChange('ate', event.target.value)}
          />
        )}
      </Field>
    </>
  );
}

/** "Período: 17/10/2026 a 15/11/2026 (30 dias)" — o período que o back usou, já com os padrões. */
export function PeriodoResumo({ periodo }: { periodo: Periodo }): ReactElement {
  return (
    <p className="mb-sm text-sm text-foreground-muted">
      Período: <span className="tabular-nums">{formatarData(periodo.de)}</span> a{' '}
      <span className="tabular-nums">{formatarData(periodo.ate)}</span> (
      {periodo.dias === 1 ? '1 dia' : `${String(periodo.dias)} dias`})
    </p>
  );
}

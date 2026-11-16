import { ehNumerica, idDoCampo, MAX_PERGUNTAS, temOpcoes } from './modelo-validacao';
import { TIPO_PERGUNTA_LABEL, TIPOS_PERGUNTA } from './questionario-formato';
import { Field } from '../../components/form/field';

import type { ReactElement } from 'react';

import type { ErrosModelo, PerguntaForm } from './modelo-validacao';
import type { TipoPergunta } from './questionarios-api';

interface ConstrutorPerguntasProps {
  perguntas: PerguntaForm[];
  erros: ErrosModelo;
  /** Mudou um campo de uma pergunta (o erro daquele campo some). */
  onAlterar: (indice: number, alteracao: Partial<PerguntaForm>, campo: keyof PerguntaForm) => void;
  /** Adicionou, removeu ou mudou a ordem (as posições mudam, então os erros das perguntas somem). */
  onReordenar: (perguntas: PerguntaForm[]) => void;
  onAdicionar: () => void;
}

/**
 * FE-QST-02 · Construtor de perguntas: adicionar, ordenar (↑ ↓), escolher o tipo,
 * marcar como obrigatória e, em número/escala, marcar para o gráfico de evolução.
 * A ordem no formulário do aluno é a ordem desta lista.
 */
export function ConstrutorPerguntas({
  perguntas,
  erros,
  onAlterar,
  onReordenar,
  onAdicionar,
}: ConstrutorPerguntasProps): ReactElement {
  const mover = (indice: number, passo: -1 | 1): void => {
    const destino = indice + passo;
    const novas = [...perguntas];
    const [pergunta] = novas.splice(indice, 1);
    if (!pergunta) return;
    novas.splice(destino, 0, pergunta);
    onReordenar(novas);
    // O foco acompanha a pergunta movida (se ela chegou na ponta, vai para o outro botão).
    setTimeout(() => {
      const mesmo = document.getElementById(
        `pergunta-${String(destino)}-${passo < 0 ? 'subir' : 'descer'}`,
      );
      const outro = document.getElementById(
        `pergunta-${String(destino)}-${passo < 0 ? 'descer' : 'subir'}`,
      );
      (mesmo instanceof HTMLButtonElement && !mesmo.disabled ? mesmo : outro)?.focus();
    });
  };

  const remover = (indice: number): void => {
    onReordenar(perguntas.filter((_, posicao) => posicao !== indice));
  };

  return (
    <section aria-labelledby="perguntas-titulo" className="grid gap-md">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 id="perguntas-titulo" className="m-0">
          Perguntas
        </h2>
        <span className="text-sm text-foreground-muted">
          {perguntas.length} de {MAX_PERGUNTAS}
        </span>
      </div>

      {erros['perguntas'] && (
        <p id="perguntas" tabIndex={-1} className="m-0 text-sm text-danger">
          {erros['perguntas']}
        </p>
      )}

      <ol className="m-0 grid list-none gap-md p-0">
        {perguntas.map((pergunta, indice) => (
          <li key={pergunta.chave}>
            <PerguntaCard
              pergunta={pergunta}
              indice={indice}
              total={perguntas.length}
              erros={erros}
              onAlterar={(alteracao, campo) => onAlterar(indice, alteracao, campo)}
              onSubir={() => mover(indice, -1)}
              onDescer={() => mover(indice, 1)}
              onRemover={() => remover(indice)}
            />
          </li>
        ))}
      </ol>

      <div>
        <button
          type="button"
          className="hf-button hf-button--secondary w-full md:w-auto"
          disabled={perguntas.length >= MAX_PERGUNTAS}
          onClick={onAdicionar}
        >
          + Adicionar pergunta
        </button>
      </div>
    </section>
  );
}

interface PerguntaCardProps {
  pergunta: PerguntaForm;
  indice: number;
  total: number;
  erros: ErrosModelo;
  onAlterar: (alteracao: Partial<PerguntaForm>, campo: keyof PerguntaForm) => void;
  onSubir: () => void;
  onDescer: () => void;
  onRemover: () => void;
}

function PerguntaCard({
  pergunta,
  indice,
  total,
  erros,
  onAlterar,
  onSubir,
  onDescer,
  onRemover,
}: PerguntaCardProps): ReactElement {
  const numero = indice + 1;
  const caminho = (campo: string): string => `perguntas.${String(indice)}.${campo}`;
  const id = (campo: string): string => idDoCampo(caminho(campo));
  const erro = (campo: string): string | undefined => erros[caminho(campo)];
  const escala = pergunta.tipo === 'escala';

  /** Trocar o tipo: o gráfico de evolução só vale para número/escala. */
  const trocarTipo = (tipo: TipoPergunta): void => {
    onAlterar({ tipo, exibirEvolucao: ehNumerica(tipo) ? pergunta.exibirEvolucao : false }, 'tipo');
  };

  return (
    <fieldset className="m-0 grid min-w-0 gap-md rounded-md border border-border bg-surface p-md">
      <legend className="sr-only">Pergunta {numero}</legend>

      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-heading font-semibold" aria-hidden="true">
          Pergunta <span className="tabular-nums">{numero}</span>
        </span>
        <div className="flex gap-xs">
          <button
            id={`pergunta-${String(indice)}-subir`}
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover pergunta ${String(numero)} para cima`}
            disabled={indice === 0}
            onClick={onSubir}
          >
            ↑
          </button>
          <button
            id={`pergunta-${String(indice)}-descer`}
            type="button"
            className="hf-button hf-button--secondary px-3"
            aria-label={`Mover pergunta ${String(numero)} para baixo`}
            disabled={indice === total - 1}
            onClick={onDescer}
          >
            ↓
          </button>
          <button
            type="button"
            className="hf-button hf-button--danger"
            aria-label={`Remover pergunta ${String(numero)}`}
            onClick={onRemover}
          >
            Remover
          </button>
        </div>
      </div>

      <div className="grid gap-md md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field id={id('enunciado')} label="Enunciado" required error={erro('enunciado')}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              maxLength={500}
              placeholder="Ex.: Qual o seu peso atual?"
              value={pergunta.enunciado}
              onChange={(event) => onAlterar({ enunciado: event.target.value }, 'enunciado')}
            />
          )}
        </Field>
        <Field id={id('tipo')} label="Tipo" required>
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={pergunta.tipo}
              onChange={(event) => trocarTipo(event.target.value as TipoPergunta)}
            >
              {TIPOS_PERGUNTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_PERGUNTA_LABEL[tipo]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {temOpcoes(pergunta.tipo) && (
        <Field
          id={id('opcoes')}
          label="Opções"
          required
          hint="Uma opção por linha (de 2 a 30)."
          error={erro('opcoes')}
        >
          {(a11y) => (
            <textarea
              {...a11y}
              className="hf-input min-h-28"
              rows={4}
              placeholder={'Sedentário\nModerado\nIntenso'}
              value={pergunta.opcoes}
              onChange={(event) => onAlterar({ opcoes: event.target.value }, 'opcoes')}
            />
          )}
        </Field>
      )}

      {ehNumerica(pergunta.tipo) && (
        <div className="grid gap-md md:grid-cols-3">
          <Field id={id('unidade')} label="Unidade" hint="Ex.: kg, cm." error={erro('unidade')}>
            {(a11y) => (
              <input
                {...a11y}
                className="hf-input"
                autoComplete="off"
                maxLength={20}
                value={pergunta.unidade}
                onChange={(event) => onAlterar({ unidade: event.target.value }, 'unidade')}
              />
            )}
          </Field>
          <Field id={id('min')} label="Mínimo" required={escala} error={erro('min')}>
            {(a11y) => (
              <input
                {...a11y}
                className="hf-input"
                inputMode={escala ? 'numeric' : 'decimal'}
                autoComplete="off"
                placeholder={escala ? '0' : undefined}
                value={pergunta.min}
                onChange={(event) => onAlterar({ min: event.target.value }, 'min')}
              />
            )}
          </Field>
          <Field id={id('max')} label="Máximo" required={escala} error={erro('max')}>
            {(a11y) => (
              <input
                {...a11y}
                className="hf-input"
                inputMode={escala ? 'numeric' : 'decimal'}
                autoComplete="off"
                placeholder={escala ? '10' : undefined}
                value={pergunta.max}
                onChange={(event) => onAlterar({ max: event.target.value }, 'max')}
              />
            )}
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-xs md:flex-row md:gap-lg">
        <Checkbox
          id={id('obrigatoria')}
          label="Obrigatória"
          checked={pergunta.obrigatoria}
          onChange={(obrigatoria) => onAlterar({ obrigatoria }, 'obrigatoria')}
        />
        {ehNumerica(pergunta.tipo) && (
          <Checkbox
            id={id('exibirEvolucao')}
            label="Exibir no gráfico de evolução"
            checked={pergunta.exibirEvolucao}
            error={erro('exibirEvolucao')}
            onChange={(exibirEvolucao) => onAlterar({ exibirEvolucao }, 'exibirEvolucao')}
          />
        )}
      </div>
    </fieldset>
  );
}

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  error?: string | undefined;
  onChange: (checked: boolean) => void;
}

/** Caixa de marcar com alvo de toque de 44px (a linha inteira é clicável). */
function Checkbox({ id, label, checked, error, onChange }: CheckboxProps): ReactElement {
  return (
    <div>
      <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-sm">
        <input
          id={id}
          type="checkbox"
          className="size-5 cursor-pointer accent-primary"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-erro` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {error && (
        <p id={`${id}-erro`} className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

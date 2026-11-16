import { useId } from 'react';

import { Field } from '../../components/form/field';

import type { ReactElement, ReactNode } from 'react';

import type { RespostaAvaliacao } from './avaliacoes-api';
import type { PerguntaRespondida } from '../questionarios/questionarios-api';

/**
 * Valor de uma pergunta enquanto o profissional preenche. Número e escala ficam como texto
 * (o que foi digitado) e só viram número ao salvar.
 */
export type ValorCampo = string | string[] | boolean | null;

/** Mesmos limites de texto do back (respostas.valores.ts). */
const MAX_TEXTO_CURTO = 500;
const MAX_TEXTO_LONGO = 5000;

/** Valor que veio da API (rascunho retomado) → valor do campo. */
export function valorInicial({ valor }: PerguntaRespondida): ValorCampo {
  return typeof valor === 'number' ? String(valor) : valor;
}

/**
 * Valor do campo → valor enviado à API, no formato do tipo da pergunta.
 * Campo vazio vira null (apaga a resposta). Número inválido vira texto: o back recusa
 * com a mensagem dele ("Responda com um número."), que aparece embaixo da pergunta.
 */
export function valorParaApi(
  pergunta: PerguntaRespondida,
  valor: ValorCampo,
): RespostaAvaliacao['valor'] {
  if (valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)) {
    return null;
  }
  if ((pergunta.tipo === 'numero' || pergunta.tipo === 'escala') && typeof valor === 'string') {
    const numero = Number(valor.replace(',', '.'));
    return Number.isFinite(numero) ? numero : valor;
  }
  return valor;
}

interface CampoPerguntaProps {
  pergunta: PerguntaRespondida;
  valor: ValorCampo;
  erro?: string | undefined;
  onChange: (valor: ValorCampo) => void;
}

/** Id do campo na página (o id da pergunta pode começar com número, inválido em seletor CSS). */
export function idDoCampo(perguntaId: string): string {
  return `pergunta-${perguntaId}`;
}

/** Uma pergunta do questionário como campo de formulário, conforme o tipo (BE-QST-02). */
export function CampoPergunta({
  pergunta,
  valor,
  erro,
  onChange,
}: CampoPerguntaProps): ReactElement {
  const id = idDoCampo(pergunta.id);
  const label = `${pergunta.ordem}. ${pergunta.enunciado}`;
  const texto = typeof valor === 'string' ? valor : '';

  switch (pergunta.tipo) {
    case 'escolha_unica':
      return (
        <Grupo id={id} label={label} obrigatoria={pergunta.obrigatoria} erro={erro}>
          {(pergunta.opcoes ?? []).map((opcao) => (
            <Opcao
              key={opcao}
              tipo="radio"
              name={id}
              label={opcao}
              checked={valor === opcao}
              onChange={() => onChange(opcao)}
            />
          ))}
        </Grupo>
      );

    case 'multipla_escolha': {
      const marcadas = Array.isArray(valor) ? valor : [];
      return (
        <Grupo id={id} label={label} obrigatoria={pergunta.obrigatoria} erro={erro}>
          {(pergunta.opcoes ?? []).map((opcao) => (
            <Opcao
              key={opcao}
              tipo="checkbox"
              name={id}
              label={opcao}
              checked={marcadas.includes(opcao)}
              onChange={(marcada) =>
                onChange(marcada ? [...marcadas, opcao] : marcadas.filter((item) => item !== opcao))
              }
            />
          ))}
        </Grupo>
      );
    }

    case 'sim_nao':
      return (
        <Grupo id={id} label={label} obrigatoria={pergunta.obrigatoria} erro={erro}>
          <Opcao
            tipo="radio"
            name={id}
            label="Sim"
            checked={valor === true}
            onChange={() => onChange(true)}
          />
          <Opcao
            tipo="radio"
            name={id}
            label="Não"
            checked={valor === false}
            onChange={() => onChange(false)}
          />
        </Grupo>
      );

    case 'texto_longo':
      return (
        <Field id={id} label={label} required={pergunta.obrigatoria} error={erro}>
          {(a11y) => (
            <textarea
              {...a11y}
              className="hf-input min-h-28"
              maxLength={MAX_TEXTO_LONGO}
              value={texto}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      );

    case 'numero':
    case 'escala':
      return (
        <Field
          id={id}
          label={label}
          required={pergunta.obrigatoria}
          hint={dicaNumero(pergunta)}
          error={erro}
        >
          {(a11y) => (
            <input
              {...a11y}
              type="number"
              inputMode="decimal"
              className="hf-input max-w-[240px]"
              step={pergunta.tipo === 'escala' ? 1 : 0.01}
              min={pergunta.min ?? undefined}
              max={pergunta.max ?? undefined}
              value={texto}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      );

    case 'data':
      return (
        <Field id={id} label={label} required={pergunta.obrigatoria} error={erro}>
          {(a11y) => (
            <input
              {...a11y}
              type="date"
              className="hf-input max-w-[240px]"
              value={texto}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      );

    default:
      // texto_curto
      return (
        <Field id={id} label={label} required={pergunta.obrigatoria} error={erro}>
          {(a11y) => (
            <input
              {...a11y}
              className="hf-input"
              autoComplete="off"
              maxLength={MAX_TEXTO_CURTO}
              value={texto}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      );
  }
}

/** "De 0 a 10 · kg" — só o que a pergunta tiver. */
function dicaNumero({ min, max, unidade }: PerguntaRespondida): string | undefined {
  const partes = [
    min !== null && max !== null ? `De ${min} a ${max}` : null,
    min !== null && max === null ? `Mínimo ${min}` : null,
    max !== null && min === null ? `Máximo ${max}` : null,
    unidade ? `Em ${unidade}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/** Grupo de opções (radio/checkbox) com o mesmo visual do Field: título, * e erro. */
function Grupo({
  id,
  label,
  obrigatoria,
  erro,
  children,
}: {
  id: string;
  label: string;
  obrigatoria: boolean;
  erro?: string | undefined;
  children: ReactNode;
}): ReactElement {
  const erroId = erro ? `${id}-erro` : undefined;
  return (
    <fieldset
      id={id}
      // tabIndex -1: recebe o foco quando o back aponta erro nesta pergunta.
      tabIndex={-1}
      className="m-0 flex min-w-0 flex-col gap-xs border-0 p-0"
      aria-invalid={Boolean(erro)}
      aria-describedby={erroId}
    >
      <legend className="mb-xs p-0 font-semibold">
        {label}
        {obrigatoria && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="grid gap-x-md md:grid-cols-2">{children}</div>
      {erro && (
        <p id={erroId} className="m-0 text-sm text-danger">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

function Opcao({
  tipo,
  name,
  label,
  checked,
  onChange,
}: {
  tipo: 'radio' | 'checkbox';
  name: string;
  label: string;
  checked: boolean;
  onChange: (marcada: boolean) => void;
}): ReactElement {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-sm">
      <input
        id={id}
        type={tipo}
        name={name}
        className="size-5 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

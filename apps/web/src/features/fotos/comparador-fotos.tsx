import { useState } from 'react';

import { FotoImagem } from './foto-imagem';
import { fotosApi } from './fotos-api';
import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarData } from '../alunos/aluno-formato';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { Comparacao, Foto } from './fotos-api';

type LinhaPose = Comparacao['poses'][number];

/**
 * FE-FOT-03 · Comparador antes/depois: escolhe duas datas e uma pose; a foto "depois" fica
 * sobre a "antes" e o slider move a divisão entre elas.
 * `datas` vem da galeria, da mais recente para a mais antiga (precisa ter pelo menos 2).
 * Começa comparando a data mais antiga (base) com a mais recente (atual).
 */
export function ComparadorFotos({
  alunoId,
  datas,
}: {
  alunoId: string;
  datas: string[];
}): ReactElement {
  const maisRecente = datas[0] ?? '';
  const [antes, setAntes] = useState(datas[datas.length - 1] ?? '');
  const [depois, setDepois] = useState(maisRecente);
  const [poseId, setPoseId] = useState<string | null>(null);

  const comparacao = useAsync(
    async (signal) => fotosApi.comparar(alunoId, { antes, depois }, signal),
    [alunoId, antes, depois],
  );

  /** "Depois" precisa ser posterior a "antes" (regra do back); se não for, vira a mais recente. */
  const trocarAntes = (data: string): void => {
    setAntes(data);
    if (depois <= data) setDepois(maisRecente);
  };

  let conteudo: ReactElement;
  if (comparacao.status === 'loading') {
    conteudo = <LoadingState label="Carregando comparação…" />;
  } else if (comparacao.status === 'error') {
    conteudo = (
      <ErrorState
        error={comparacao.error}
        title="Não conseguimos carregar a comparação"
        message={mensagemDaApi(comparacao.error)}
        onRetry={comparacao.reload}
      />
    );
  } else if (comparacao.data.poses.length === 0) {
    conteudo = (
      <EmptyState
        title="Nada para comparar"
        description="Escolha outras datas para ver as fotos lado a lado."
      />
    );
  } else {
    const linhas = comparacao.data.poses;
    const atual = linhas.find((linha) => linha.pose.id === poseId) ?? linhas[0];
    conteudo = (
      <div className="grid gap-md">
        <div role="group" aria-label="Pose" className="flex flex-wrap gap-sm">
          {linhas.map((linha) => {
            const selecionada = linha.pose.id === atual?.pose.id;
            return (
              <button
                key={linha.pose.id}
                type="button"
                aria-pressed={selecionada}
                className={`hf-button hf-button--secondary ${selecionada ? 'border-foreground bg-border' : ''}`}
                onClick={() => setPoseId(linha.pose.id)}
              >
                {linha.pose.nome}
              </button>
            );
          })}
        </div>
        {atual && <Slider linha={atual} onRecarregar={comparacao.reload} />}
      </div>
    );
  }

  return (
    <section className="grid gap-md rounded-md border border-border bg-surface p-md">
      <h2 className="m-0">Comparador antes/depois</h2>
      <div className="grid gap-md md:grid-cols-2">
        <Field id="data-antes" label="Antes">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={antes}
              onChange={(event) => trocarAntes(event.target.value)}
            >
              {/* A mais recente fica de fora: não haveria "depois" para ela. */}
              {datas.slice(1).map((data) => (
                <option key={data} value={data}>
                  {formatarData(data)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="data-depois" label="Depois">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={depois}
              onChange={(event) => setDepois(event.target.value)}
            >
              {datas
                .filter((data) => data > antes)
                .map((data) => (
                  <option key={data} value={data}>
                    {formatarData(data)}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </div>
      {conteudo}
    </section>
  );
}

/** Rótulo da foto: "Antes · 03/08/2026". */
const rotulo = (lado: 'Antes' | 'Depois', foto: Foto): string =>
  `${lado} · ${formatarData(foto.dataRegistro)}`;

/**
 * As duas fotos da pose sobrepostas: "antes" embaixo, "depois" por cima, recortada a partir
 * da posição do slider (esquerda = antes, direita = depois).
 * Se faltar a foto de uma das datas, mostra só a que existe, com o aviso.
 */
function Slider({
  linha,
  onRecarregar,
}: {
  linha: LinhaPose;
  onRecarregar: () => void;
}): ReactElement {
  const [posicao, setPosicao] = useState(50);
  const { antes, depois, pose } = linha;
  const moldura = 'relative mx-auto aspect-[3/4] w-full max-w-[480px] overflow-hidden rounded-sm';

  if (!antes || !depois) {
    const existente = antes ?? depois;
    return (
      <div className="grid gap-sm">
        <p className="m-0 text-foreground-muted">
          Esta pose não tem foto nas duas datas. Mostrando só a que existe.
        </p>
        {existente && (
          <figure className="m-0 grid gap-xs">
            <div className={moldura}>
              <FotoImagem
                src={existente.url}
                alt={`${pose.nome} — ${rotulo(antes ? 'Antes' : 'Depois', existente)}`}
                className="absolute inset-0 size-full object-contain"
                onRecarregar={onRecarregar}
              />
            </div>
            <figcaption className="text-center text-sm text-foreground-muted tabular-nums">
              {rotulo(antes ? 'Antes' : 'Depois', existente)}
            </figcaption>
          </figure>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-sm">
      <div className="flex justify-between gap-sm text-sm text-foreground-muted tabular-nums">
        <span>{rotulo('Antes', antes)}</span>
        <span>{rotulo('Depois', depois)}</span>
      </div>
      <div className={moldura}>
        <FotoImagem
          src={antes.url}
          alt={`${pose.nome} — ${rotulo('Antes', antes)}`}
          className="absolute inset-0 size-full object-contain"
          onRecarregar={onRecarregar}
        />
        {/* Recorte e posição da linha mudam com o slider: valores dinâmicos, por isso inline. */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${posicao}%)` }}>
          <FotoImagem
            src={depois.url}
            alt={`${pose.nome} — ${rotulo('Depois', depois)}`}
            className="absolute inset-0 size-full object-contain"
            onRecarregar={onRecarregar}
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
          style={{ left: `${posicao}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={posicao}
        aria-label="Divisão entre a foto antes e a foto depois"
        aria-valuetext={`${posicao}% antes`}
        className="mx-auto w-full max-w-[480px] accent-primary"
        onChange={(event) => setPosicao(Number(event.target.value))}
      />
    </div>
  );
}

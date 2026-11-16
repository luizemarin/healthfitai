import { useEffect, useState } from 'react';

import { Link } from 'react-router';

import { Field } from '../../components/form/field';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { exerciciosApi } from '../exercicios/exercicios-api';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

import type { ExercicioResumo } from './treinos-api';

const ESPERA_BUSCA_MS = 300;

interface SeletorExercicioProps {
  /** Exercícios que já estão no treino (cada um entra uma vez só). */
  jaAdicionados: ReadonlySet<string>;
  /** Treino cheio: não dá para adicionar mais. */
  cheio: boolean;
  onAdicionar: (exercicio: ExercicioResumo) => void;
}

/**
 * Busca na biblioteca de exercícios (FE-EXE-01) para montar o treino.
 * Mostra a primeira página do resultado; refine a busca para achar o exercício.
 */
export function SeletorExercicio({
  jaAdicionados,
  cheio,
  onAdicionar,
}: SeletorExercicioProps): ReactElement {
  // O campo responde na hora; a chamada à API só depois de uma pausa na digitação.
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setQ(busca.trim() || undefined), ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const exercicios = useAsync(async (signal) => exerciciosApi.listar({ q, page: 1 }, signal), [q]);

  let resultado: ReactElement;
  if (exercicios.status === 'loading') {
    resultado = <LoadingState label="Carregando exercícios…" />;
  } else if (exercicios.status === 'error') {
    resultado = (
      <ErrorState
        error={exercicios.error}
        title="Não conseguimos carregar a biblioteca de exercícios"
        message={mensagemDaApi(exercicios.error)}
        onRetry={exercicios.reload}
      />
    );
  } else if (exercicios.data.data.length === 0) {
    resultado = q ? (
      <EmptyState
        title="Nenhum exercício encontrado"
        description="Nenhum exercício da biblioteca corresponde à busca."
      />
    ) : (
      <EmptyState
        title="Sua biblioteca está vazia"
        description="Cadastre exercícios na biblioteca para montar os treinos."
        action={
          <Link to="/exercicios/novo" className="hf-button">
            Cadastrar exercício
          </Link>
        }
      />
    );
  } else {
    const { data, meta } = exercicios.data;
    resultado = (
      <>
        <ul className="m-0 grid list-none gap-sm p-0">
          {data.map((exercicio) => {
            const adicionado = jaAdicionados.has(exercicio.id);
            return (
              <li
                key={exercicio.id}
                className="flex items-center justify-between gap-md rounded-sm border border-border p-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{exercicio.nome}</span>
                  <span className="text-sm text-foreground-muted">{exercicio.grupoMuscular}</span>
                </span>
                <button
                  type="button"
                  className="hf-button hf-button--secondary shrink-0"
                  disabled={adicionado || cheio}
                  aria-label={`Adicionar ${exercicio.nome} ao treino`}
                  onClick={() =>
                    onAdicionar({
                      id: exercicio.id,
                      nome: exercicio.nome,
                      grupoMuscular: exercicio.grupoMuscular,
                      ativo: true,
                    })
                  }
                >
                  {adicionado ? 'Adicionado' : 'Adicionar'}
                </button>
              </li>
            );
          })}
        </ul>
        {meta.totalItems > data.length && (
          <p className="m-0 text-sm text-foreground-muted">
            Mostrando {data.length} de {meta.totalItems}. Busque pelo nome para achar outros.
          </p>
        )}
      </>
    );
  }

  return (
    <section
      aria-labelledby="biblioteca-titulo"
      className="grid gap-md rounded-md border border-border bg-surface p-md"
    >
      <h2 id="biblioteca-titulo" className="m-0 text-lg">
        Adicionar exercício
      </h2>
      <Field id="busca-exercicio" label="Buscar na biblioteca">
        {(a11y) => (
          <input
            {...a11y}
            type="search"
            className="hf-input"
            placeholder="Nome ou grupo muscular"
            maxLength={100}
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        )}
      </Field>
      {resultado}
    </section>
  );
}

import { useState } from 'react';

import { ApiError } from '../api/api-error';
import { AsyncContent, EmptyState, useAsync } from '../components/states';

import type { ReactElement } from 'react';

type Scenario = 'sucesso' | 'vazio' | 'sem-conexao' | 'erro-servidor';

const scenarios: Scenario[] = ['sucesso', 'vazio', 'sem-conexao', 'erro-servidor'];

/** Simula uma chamada à API que demora 1s e termina conforme o cenário escolhido. */
async function fakeLoad(scenario: Scenario, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (scenario === 'sem-conexao') reject(ApiError.network());
      else if (scenario === 'erro-servidor') reject(new ApiError(500, 'INTERNAL', 'Falha'));
      else resolve(scenario === 'vazio' ? [] : ['Ana', 'Bruno', 'Carla']);
    }, 1000);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Só em desenvolvimento (/_dev/estados): mostra os estados padrão (FE-SET-04) para conferir
 * visual e responsividade sem depender da API. Também serve de exemplo de uso.
 */
export function DevStatesPage(): ReactElement {
  const [scenario, setScenario] = useState<Scenario>('sucesso');
  const alunos = useAsync(async (signal) => fakeLoad(scenario, signal), [scenario]);

  return (
    <>
      <h1>Estados das telas</h1>
      <div className="mb-lg flex flex-wrap gap-3">
        {scenarios.map((item) => (
          <button
            key={item}
            type="button"
            className={item === scenario ? 'hf-button' : 'hf-button hf-button--secondary'}
            onClick={() => setScenario(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <AsyncContent
        state={alunos}
        loadingLabel="Carregando alunos…"
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            title="Nenhum aluno cadastrado"
            description="Cadastre seu primeiro aluno para começar o acompanhamento."
          />
        }
      >
        {(list) => (
          <ul className="list-disc pl-lg">
            {list.map((nome) => (
              <li key={nome}>{nome}</li>
            ))}
          </ul>
        )}
      </AsyncContent>
    </>
  );
}

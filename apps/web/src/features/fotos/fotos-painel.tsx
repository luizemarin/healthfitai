import { Link, useSearchParams } from 'react-router';

import { ComparadorFotos } from './comparador-fotos';
import { FotoImagem } from './foto-imagem';
import { fotosApi } from './fotos-api';
import { EmptyState, ErrorState, LoadingState, useAsync } from '../../components/states';
import { formatarData } from '../alunos/aluno-formato';
import { mensagemDaApi } from '../questionarios/questionario-formato';

import type { ReactElement } from 'react';

/**
 * Aba "Fotos" da ficha.
 *   FE-FOT-03 · comparador antes/depois (quando há fotos em pelo menos duas datas)
 *   FE-FOT-02 · galeria: fotos agrupadas por data (mais recente primeiro) e, no dia, pela pose
 * As fotos são enviadas pelo aluno no app; as poses pedidas são configuradas em /fotos/poses.
 */
export function FotosPainel({ alunoId }: { alunoId: string }): ReactElement {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const galeria = useAsync(
    async (signal) => fotosApi.galeria(alunoId, page, signal),
    [alunoId, page],
  );

  const configurarPoses = (
    <Link to="/fotos/poses" className="hf-button hf-button--secondary">
      Configurar poses
    </Link>
  );

  const irParaPagina = (nova: number): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        novo.set('pagina', String(nova));
        return novo;
      },
      { replace: true },
    );
  };

  if (galeria.status === 'loading') {
    return <LoadingState label="Carregando fotos…" />;
  }
  if (galeria.status === 'error') {
    return (
      <ErrorState
        error={galeria.error}
        title="Não conseguimos carregar as fotos"
        message={mensagemDaApi(galeria.error)}
        onRetry={galeria.reload}
      />
    );
  }

  const { data: dias, meta } = galeria.data;
  if (dias.length === 0) {
    return (
      <EmptyState
        title="Nenhuma foto ainda"
        description="As fotos que o aluno envia pelo app aparecem aqui, agrupadas por data e pose."
        action={configurarPoses}
      />
    );
  }

  const datas = dias.map((dia) => dia.dataRegistro);

  return (
    <div className="grid gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <p className="m-0 text-foreground-muted">
          Fotos enviadas pelo aluno, agrupadas por data e pose.
        </p>
        {configurarPoses}
      </div>

      {datas.length >= 2 ? (
        // key: ao trocar de página, o comparador recomeça com as datas da página nova.
        <ComparadorFotos key={meta.page} alunoId={alunoId} datas={datas} />
      ) : (
        <p className="m-0 rounded-md border border-border bg-surface p-md text-foreground-muted">
          Quando houver fotos em duas datas diferentes, o comparador antes/depois aparece aqui.
        </p>
      )}

      <section className="grid gap-md">
        <h2 className="m-0">Fotos por data</h2>
        {dias.map((dia) => (
          <article
            key={dia.dataRegistro}
            className="grid gap-sm rounded-md border border-border bg-surface p-md"
          >
            <h3 className="m-0 tabular-nums">{formatarData(dia.dataRegistro)}</h3>
            <ul className="m-0 grid list-none grid-cols-2 gap-sm p-0 md:grid-cols-4 xl:grid-cols-6">
              {dia.fotos.map((foto) => (
                <li key={foto.id}>
                  <figure className="m-0 grid gap-xs">
                    <FotoImagem
                      src={foto.miniaturaUrl ?? foto.url}
                      alt={`${foto.pose.nome} — ${formatarData(foto.dataRegistro)}`}
                      className="aspect-[3/4] w-full"
                      onRecarregar={galeria.reload}
                    />
                    <figcaption className="text-sm text-foreground-muted">
                      {foto.pose.nome}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm">
          <button
            type="button"
            className="hf-button hf-button--secondary"
            disabled={meta.page <= 1}
            onClick={() => irParaPagina(meta.page - 1)}
          >
            Anterior
          </button>
          <span className="text-sm text-foreground-muted">
            {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="hf-button hf-button--secondary"
            disabled={meta.page >= meta.totalPages}
            onClick={() => irParaPagina(meta.page + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

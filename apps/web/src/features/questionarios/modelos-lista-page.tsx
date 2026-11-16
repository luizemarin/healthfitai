import { useEffect, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router';

import { avisarErro } from './avisar-erro';
import { sexoAlvoLabel, TIPO_MODELO_LABEL, TIPOS_MODELO } from './questionario-formato';
import { modelosApi } from './questionarios-api';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { Field } from '../../components/form/field';
import { AsyncContent, EmptyState, useAsync } from '../../components/states';
import { StatusBadge } from '../alunos/status-badge';

import type { ReactElement } from 'react';

import type { FiltrosModelos, ModeloResumo, TipoModelo } from './questionarios-api';

const ESPERA_BUSCA_MS = 300;

/** Lê os filtros da URL: a lista filtrada pode ser recarregada, voltada e compartilhada. */
function lerFiltros(params: URLSearchParams): FiltrosModelos {
  const tipo = params.get('tipo');
  const ativo = params.get('ativo');
  const page = Number(params.get('page'));
  return {
    q: params.get('q')?.trim() ? params.get('q')?.trim() : undefined,
    tipo: TIPOS_MODELO.includes(tipo as TipoModelo) ? (tipo as TipoModelo) : undefined,
    ativo: ativo === 'true' || ativo === 'false' ? ativo : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** FE-QST-01 · Gestão de modelos: listar por tipo, criar, duplicar, editar e desativar. */
export function ModelosListaPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const { q, tipo, ativo, page } = lerFiltros(params);
  const temFiltro = Boolean(q ?? tipo ?? ativo);
  const linkCriar = tipo ? `/questionarios/novo?tipo=${tipo}` : '/questionarios/novo';

  // Busca: o campo responde na hora; a URL (e a chamada à API) só depois de uma pausa na digitação.
  const [busca, setBusca] = useState(q ?? '');

  /** Troca um filtro e volta para a página 1. */
  const filtrar = (nome: 'q' | 'tipo' | 'ativo', valor: string): void => {
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        if (valor.trim()) novo.set(nome, valor.trim());
        else novo.delete(nome);
        novo.delete('page');
        return novo;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (busca.trim() === (q ?? '')) return undefined;
    const timer = setTimeout(() => filtrar('q', busca), ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à digitação
  }, [busca]);

  const irParaPagina = (nova: number): void => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.set('page', String(nova));
      return novo;
    });
    window.scrollTo({ top: 0 });
  };

  const limparFiltros = (): void => {
    setBusca('');
    setParams({}, { replace: true });
  };

  const modelos = useAsync(
    async (signal) => modelosApi.listar({ q, tipo, ativo, page }, signal),
    [q, tipo, ativo, page],
  );

  // Ações: um modelo por vez; o diálogo de desativar é um só para a tela.
  const navigate = useNavigate();
  const toast = useToast();
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [desativando, setDesativando] = useState<ModeloResumo | null>(null);

  const duplicar = async (modelo: ModeloResumo): Promise<void> => {
    setOcupadoId(modelo.id);
    try {
      const copia = await modelosApi.duplicar(modelo.id);
      toast.success('Modelo duplicado.', `"${copia.nome}" já pode ser editado.`);
      await navigate(`/questionarios/${copia.id}`);
    } catch (error) {
      avisarErro(toast, error, 'Não foi possível duplicar');
      setOcupadoId(null);
    }
  };

  /** Desativar não apaga nada: as respostas já registradas continuam ligadas ao modelo. */
  const alternarSituacao = async (modelo: ModeloResumo): Promise<void> => {
    setOcupadoId(modelo.id);
    try {
      if (modelo.ativo) {
        await modelosApi.desativar(modelo.id);
        toast.success('Modelo desativado.', 'As respostas já registradas continuam guardadas.');
      } else {
        await modelosApi.ativar(modelo.id);
        toast.success('Modelo ativado.');
      }
      modelos.reload();
    } catch (error) {
      avisarErro(
        toast,
        error,
        modelo.ativo ? 'Não foi possível desativar' : 'Não foi possível ativar',
      );
    } finally {
      setOcupadoId(null);
      setDesativando(null);
    }
  };

  return (
    <>
      <div className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0">Questionários</h1>
        <Link to={linkCriar} className="hf-button">
          Criar modelo
        </Link>
      </div>

      <div className="mb-lg grid gap-md md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field id="busca" label="Buscar">
          {(a11y) => (
            <input
              {...a11y}
              type="search"
              className="hf-input"
              placeholder="Nome do modelo"
              maxLength={100}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          )}
        </Field>
        <Field id="filtro-tipo" label="Tipo">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={tipo ?? ''}
              onChange={(event) => filtrar('tipo', event.target.value)}
            >
              <option value="">Todos</option>
              {TIPOS_MODELO.map((item) => (
                <option key={item} value={item}>
                  {TIPO_MODELO_LABEL[item]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="filtro-ativo" label="Situação">
          {(a11y) => (
            <select
              {...a11y}
              className="hf-input"
              value={ativo ?? ''}
              onChange={(event) => filtrar('ativo', event.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          )}
        </Field>
      </div>

      <AsyncContent
        state={modelos}
        loadingLabel="Carregando modelos…"
        isEmpty={(lista) => lista.data.length === 0}
        empty={
          temFiltro ? (
            <EmptyState
              title="Nenhum modelo encontrado"
              description="Nenhum modelo corresponde à busca ou aos filtros."
              action={
                <button
                  type="button"
                  className="hf-button hf-button--secondary"
                  onClick={limparFiltros}
                >
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Nenhum modelo cadastrado"
              description="Crie um modelo de anamnese, avaliação ou feedback."
              action={
                <Link to={linkCriar} className="hf-button">
                  Criar modelo
                </Link>
              }
            />
          )
        }
      >
        {({ data, meta }) => (
          <>
            <p className="mb-sm text-sm text-foreground-muted">
              {meta.totalItems === 1 ? '1 modelo' : `${String(meta.totalItems)} modelos`}
            </p>
            <ul className="m-0 grid list-none gap-sm p-0">
              {data.map((modelo) => (
                <li key={modelo.id}>
                  <ModeloLinha
                    modelo={modelo}
                    ocupado={ocupadoId === modelo.id}
                    onDuplicar={() => void duplicar(modelo)}
                    onAlternarSituacao={() =>
                      modelo.ativo ? setDesativando(modelo) : void alternarSituacao(modelo)
                    }
                  />
                </li>
              ))}
            </ul>
            {meta.totalPages > 1 && (
              <nav
                aria-label="Paginação"
                className="mt-lg flex items-center justify-between gap-md"
              >
                <button
                  type="button"
                  className="hf-button hf-button--secondary"
                  disabled={meta.page <= 1}
                  onClick={() => irParaPagina(meta.page - 1)}
                >
                  Anterior
                </button>
                <span className="text-sm text-foreground-muted">
                  Página {meta.page} de {meta.totalPages}
                </span>
                <button
                  type="button"
                  className="hf-button hf-button--secondary"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => irParaPagina(meta.page + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </AsyncContent>

      <ConfirmDialog
        open={desativando !== null}
        title="Desativar o modelo?"
        message="Nada é apagado: as respostas já registradas continuam guardadas. Você pode ativar o modelo de novo quando quiser."
        confirmLabel="Desativar"
        danger
        busy={ocupadoId !== null}
        onConfirm={() => {
          if (desativando) void alternarSituacao(desativando);
        }}
        onCancel={() => setDesativando(null)}
      />
    </>
  );
}

interface ModeloLinhaProps {
  modelo: ModeloResumo;
  /** Alguma ação deste modelo em andamento: botões desabilitados. */
  ocupado: boolean;
  onDuplicar: () => void;
  onAlternarSituacao: () => void;
}

/**
 * Um modelo da lista com as ações dele.
 * Modelo padrão do sistema é só leitura: dá para ver e duplicar (a cópia é sua e pode ser editada).
 */
function ModeloLinha({
  modelo,
  ocupado,
  onDuplicar,
  onAlternarSituacao,
}: ModeloLinhaProps): ReactElement {
  const podeEditar = !modelo.padrao && modelo.ativo;
  const perguntas =
    modelo.totalPerguntas === 1 ? '1 pergunta' : `${String(modelo.totalPerguntas)} perguntas`;

  return (
    <div
      className={`flex flex-col gap-md rounded-md border border-border bg-surface p-md md:flex-row md:items-center md:justify-between ${
        modelo.ativo ? '' : 'opacity-75'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <Link
            to={`/questionarios/${modelo.id}`}
            className="font-heading text-lg font-semibold text-foreground"
          >
            {modelo.nome}
          </Link>
          <span className="hf-badge border-border text-foreground">
            {TIPO_MODELO_LABEL[modelo.tipo]}
          </span>
          {modelo.padrao && (
            <span className="hf-badge border-border text-foreground-muted">Padrão</span>
          )}
          <StatusBadge ativo={modelo.ativo} />
        </span>
        <span className="text-sm text-foreground-muted">
          {perguntas} · Versão <span className="font-heading tabular-nums">{modelo.versao}</span> ·{' '}
          {sexoAlvoLabel(modelo.sexoAlvo)}
        </span>
      </div>

      <div className="flex shrink-0 flex-col gap-3 md:flex-row">
        <Link to={`/questionarios/${modelo.id}`} className="hf-button hf-button--secondary">
          {podeEditar ? 'Editar' : 'Ver'}
        </Link>
        <button
          type="button"
          className="hf-button hf-button--secondary"
          disabled={ocupado}
          onClick={onDuplicar}
        >
          Duplicar
        </button>
        {!modelo.padrao && (
          <button
            type="button"
            className={modelo.ativo ? 'hf-button hf-button--danger' : 'hf-button'}
            disabled={ocupado}
            onClick={onAlternarSituacao}
          >
            {modelo.ativo ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>
    </div>
  );
}

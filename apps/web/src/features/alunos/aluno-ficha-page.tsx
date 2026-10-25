import { useRef, useState } from 'react';

import { Link, useParams, useSearchParams } from 'react-router';

import { formatarData, formatarTelefone, SEXO_LABEL } from './aluno-formato';
import { alunosApi } from './alunos-api';
import { ConviteCard } from './convite-card';
import { StatusBadge } from './status-badge';
import { ConfirmDialog } from '../../components/feedback/confirm-dialog';
import { useToast } from '../../components/feedback/toast';
import { AsyncContent, EmptyState, useAsync } from '../../components/states';

import type { KeyboardEvent, ReactElement } from 'react';

import type { PerfilAluno } from './alunos-api';

/**
 * Abas da ficha. O conteúdo de cada uma chega com o requisito dela:
 *   anamnese → FE-QST-03 · avaliacoes → FE-AVA-01/02 · feedbacks → FE-FBK-03
 *   fotos → FE-FOT-02/03 · medidas → FE-EVO-02 · evolucao → FE-EVO-01
 */
const ABAS = [
  {
    id: 'anamnese',
    label: 'Anamnese',
    vazio: 'As anamneses respondidas pelo aluno aparecem aqui.',
  },
  { id: 'avaliacoes', label: 'Avaliações', vazio: 'As avaliações físico-posturais aparecem aqui.' },
  { id: 'feedbacks', label: 'Feedbacks', vazio: 'Os feedbacks do aluno aparecem aqui.' },
  { id: 'fotos', label: 'Fotos', vazio: 'As fotos enviadas pelo aluno aparecem aqui, por data.' },
  {
    id: 'medidas',
    label: 'Peso e medidas',
    vazio: 'Os registros de peso e medidas aparecem aqui.',
  },
  { id: 'evolucao', label: 'Evolução', vazio: 'Os gráficos de evolução aparecem aqui.' },
] as const;

type AbaId = (typeof ABAS)[number]['id'];

/** FE-ALU-04 · Ficha do aluno: cabeçalho com o perfil, convite (FE-ALU-03) e abas. */
export function AlunoFichaPage(): ReactElement {
  const { id = '' } = useParams();
  const perfil = useAsync(async (signal) => alunosApi.perfil(id, signal), [id]);

  return (
    <>
      <Link to="/alunos" className="mb-md inline-flex min-h-11 items-center text-foreground-muted">
        ← Alunos
      </Link>
      <AsyncContent state={perfil} loadingLabel="Carregando ficha do aluno…">
        {(dados) => (
          // minmax(0,1fr): conteúdo largo (abas) rola dentro do bloco, sem alargar a página.
          <div className="grid grid-cols-[minmax(0,1fr)] gap-lg">
            <Cabecalho perfil={dados} onAlterado={perfil.reload} />
            <ConviteCard alunoId={dados.id} alunoAtivo={dados.ativo} />
            <Abas />
          </div>
        )}
      </AsyncContent>
    </>
  );
}

function Cabecalho({
  perfil,
  onAlterado,
}: {
  perfil: PerfilAluno;
  onAlterado: () => void;
}): ReactElement {
  const toast = useToast();
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { email, telefone } = perfil.contato;

  /** BE-ALU-02: desativar mantém todo o histórico; o convite válido é revogado pelo back. */
  const alternarSituacao = async (): Promise<void> => {
    setSalvando(true);
    try {
      if (perfil.ativo) {
        await alunosApi.desativar(perfil.id);
        toast.success('Aluno desativado.', 'O histórico continua guardado.');
      } else {
        await alunosApi.ativar(perfil.id);
        toast.success('Aluno ativado.');
      }
      onAlterado();
    } catch (error) {
      toast.fromError(
        error,
        perfil.ativo ? 'Não foi possível desativar' : 'Não foi possível ativar',
      );
    } finally {
      setSalvando(false);
      setConfirmarDesativar(false);
    }
  };

  return (
    <header className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-sm">
          <h1 className="m-0">{perfil.nome}</h1>
          <StatusBadge ativo={perfil.ativo} />
        </div>
        <p className="m-0 mt-xs text-foreground-muted">
          <span className="font-heading tabular-nums">{perfil.idade} anos</span> ·{' '}
          {SEXO_LABEL[perfil.sexo]} · Nasc. {formatarData(perfil.dataNascimento)}
        </p>
        <p className="m-0 mt-xs text-foreground-muted">
          {[email, telefone ? formatarTelefone(telefone) : null].filter(Boolean).join(' · ') ||
            'Sem contato cadastrado'}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <Link to={`/alunos/${perfil.id}/editar`} className="hf-button hf-button--secondary">
          Editar
        </Link>
        <button
          type="button"
          className={perfil.ativo ? 'hf-button hf-button--danger' : 'hf-button'}
          disabled={salvando}
          onClick={() => (perfil.ativo ? setConfirmarDesativar(true) : void alternarSituacao())}
        >
          {perfil.ativo ? 'Desativar' : 'Ativar'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmarDesativar}
        title="Desativar o aluno?"
        message="Nada é apagado: o histórico continua guardado. O convite válido, se houver, deixa de funcionar."
        confirmLabel="Desativar"
        danger
        busy={salvando}
        onConfirm={() => void alternarSituacao()}
        onCancel={() => setConfirmarDesativar(false)}
      />
    </header>
  );
}

/** Abas acessíveis (setas ← → trocam de aba). A aba aberta fica na URL (?aba=fotos). */
function Abas(): ReactElement {
  const [params, setParams] = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  const atual: AbaId = ABAS.find((aba) => aba.id === params.get('aba'))?.id ?? 'anamnese';
  const abaAtual = ABAS.find((aba) => aba.id === atual) ?? ABAS[0];

  const abrir = (aba: AbaId): void => {
    setParams({ aba }, { replace: true });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const indice = ABAS.findIndex((aba) => aba.id === atual);
    const passo = event.key === 'ArrowRight' ? 1 : -1;
    const proxima = ABAS[(indice + passo + ABAS.length) % ABAS.length] ?? ABAS[0];
    abrir(proxima.id);
    tabsRef.current?.querySelector<HTMLElement>(`#aba-${proxima.id}`)?.focus();
  };

  return (
    <section className="min-w-0">
      {/* Celular: as abas rolam de lado em vez de quebrar a linha. */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Seções da ficha"
        className="flex gap-xs overflow-x-auto border-b border-border"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === atual;
          return (
            <button
              key={aba.id}
              id={`aba-${aba.id}`}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={`painel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              className={`-mb-px min-h-11 shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-md ${
                selecionada
                  ? 'border-foreground font-semibold text-foreground'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
              onClick={() => abrir(aba.id)}
              onKeyDown={onKeyDown}
            >
              {aba.label}
            </button>
          );
        })}
      </div>
      <div
        id={`painel-${abaAtual.id}`}
        role="tabpanel"
        aria-labelledby={`aba-${abaAtual.id}`}
        className="pt-md"
      >
        <EmptyState title={`${abaAtual.label}: nada por aqui ainda`} description={abaAtual.vazio} />
      </div>
    </section>
  );
}

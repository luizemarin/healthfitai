import { createBrowserRouter } from 'react-router';

import { DevStatesPage } from './dev-states-page';
import { ErrorPage } from './error-page';
import { HomePage } from './home-page';
import { NotFoundPage } from './not-found-page';
import { RootLayout } from './root-layout';
import { AlunoFichaPage } from '../features/alunos/aluno-ficha-page';
import { AlunoEditarPage, AlunoNovoPage } from '../features/alunos/aluno-form-page';
import { AlunosListaPage } from '../features/alunos/alunos-lista-page';
import { AvaliacaoNovaPage } from '../features/avaliacoes/avaliacao-nova-page';
import { DashboardAlunoPage } from '../features/dashboard/dashboard-aluno-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { ExercicioEditarPage, ExercicioNovoPage } from '../features/exercicios/exercicio-form-page';
import { ExerciciosListaPage } from '../features/exercicios/exercicios-lista-page';
import { FeedbackAgendarPage } from '../features/feedbacks/feedback-agendar-page';
import { FeedbackDetalhePage } from '../features/feedbacks/feedback-detalhe-page';
import { PosesPage } from '../features/fotos/poses-page';
import { ModeloEditarPage, ModeloNovoPage } from '../features/questionarios/modelo-form-page';
import { ModelosListaPage } from '../features/questionarios/modelos-lista-page';
import { TreinoEditarPage, TreinoNovoPage } from '../features/treinos/treino-form-page';

import type { RouteObject } from 'react-router';

/** Páginas de apoio ao desenvolvimento: não entram no build de produção. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '_dev/estados', element: <DevStatesPage /> }]
  : [];

/**
 * Mapa de rotas do painel. Cada nova tela entra como filha do RootLayout.
 * Rotas que exigem login serão agrupadas sob um guard (FE-AUT-01).
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    // Qualquer tela que quebrar mostra a mensagem amigável em vez de uma página em branco.
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      // Alunos: FE-ALU-01 lista · FE-ALU-02 cadastro/edição · FE-ALU-03/04 ficha com convite e abas
      { path: 'alunos', element: <AlunosListaPage /> },
      { path: 'alunos/novo', element: <AlunoNovoPage /> },
      { path: 'alunos/:id', element: <AlunoFichaPage /> },
      { path: 'alunos/:id/editar', element: <AlunoEditarPage /> },
      // Avaliações: FE-AVA-01 preenchimento (o histórico FE-AVA-02 fica na aba da ficha)
      { path: 'alunos/:id/avaliacoes/nova', element: <AvaliacaoNovaPage /> },
      // Feedbacks: FE-FBK-01 agendar · FE-FBK-03 ler e comentar (o painel FE-FBK-02 fica na aba da ficha)
      { path: 'alunos/:id/feedbacks/agendar', element: <FeedbackAgendarPage /> },
      { path: 'alunos/:id/feedbacks/:feedbackId', element: <FeedbackDetalhePage /> },
      // Treinos: FE-TRE-01 montar/editar (a lista, com duplicar, fica na aba da ficha)
      { path: 'alunos/:id/treinos/novo', element: <TreinoNovoPage /> },
      { path: 'alunos/:id/treinos/:treinoId', element: <TreinoEditarPage /> },
      // Fotos: FE-FOT-01 poses (a galeria FE-FOT-02 e o comparador FE-FOT-03 ficam na aba da ficha)
      { path: 'fotos/poses', element: <PosesPage /> },
      // Questionários: FE-QST-01 gestão de modelos · FE-QST-02 construtor de perguntas
      { path: 'questionarios', element: <ModelosListaPage /> },
      { path: 'questionarios/novo', element: <ModeloNovoPage /> },
      { path: 'questionarios/:id', element: <ModeloEditarPage /> },
      // Exercícios: FE-EXE-01 biblioteca (listar, cadastrar, editar e excluir)
      { path: 'exercicios', element: <ExerciciosListaPage /> },
      { path: 'exercicios/novo', element: <ExercicioNovoPage /> },
      { path: 'exercicios/:id', element: <ExercicioEditarPage /> },
      // Dashboard: FE-DSH-01 visão consolidada dos alunos e detalhe de frequência e progresso
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'dashboard/alunos/:id', element: <DashboardAlunoPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

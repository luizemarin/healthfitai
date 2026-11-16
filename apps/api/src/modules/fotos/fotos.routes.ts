import { Router } from 'express';

import { FotosController } from './fotos.controller';
import { FotosService } from './fotos.service';

import type { FotosRepository } from './fotos.repository';
import type { FotosConfig } from './fotos.service';
import type { ObjectStorage } from '../../shared/storage/object-storage';
import type { AlunosRepository } from '../alunos/alunos.repository';

/**
 * Fotos de evolução do aluno.
 *   BE-FOT-01 · Poses configuráveis (padrão: frente, perfil e costas; sem DELETE)
 *     GET   /poses                         → listar (na 1ª vez, copia as padrão)
 *     POST  /poses                         → adicionar (entra no fim)
 *     PATCH /poses/:id                     → renomear
 *     PUT   /poses/ordem                   → reordenar (todas as ativas)
 *     POST  /poses/:id/desativar           → "remover" (as fotos antigas ficam)
 *     POST  /poses/:id/ativar
 *   BE-FOT-02 · Envio seguro, em 2 passos (o arquivo vai direto ao bucket privado)
 *     POST  /alunos/:alunoId/fotos/envios  → 1) URL assinada para o PUT
 *     POST  /alunos/:alunoId/fotos         → 2) confirmar: vira foto do aluno
 *   BE-FOT-03 · Processamento (compressão, miniatura, sem EXIF) → dentro do passo 2
 *   BE-FOT-04 · Galeria e comparador
 *     GET   /alunos/:alunoId/fotos         → agrupadas por data (paginação por data)
 *     GET   /alunos/:alunoId/fotos/comparar?antes=&depois= → antes/depois por pose
 *
 * Repositórios e storage entram por parâmetro (montados em routes.ts).
 */
export function createFotosRouter(
  repository: FotosRepository,
  alunos: AlunosRepository,
  storage: ObjectStorage,
  config: FotosConfig,
): Router {
  const controller = new FotosController(new FotosService(repository, alunos, storage, config));
  const router = Router();

  router.get('/poses', controller.listarPoses);
  router.post('/poses', controller.criarPose);
  // Antes de /poses/:id, para "ordem" não ser lido como id.
  router.put('/poses/ordem', controller.reordenarPoses);
  router.patch('/poses/:id', controller.renomearPose);
  router.post('/poses/:id/desativar', controller.desativarPose);
  router.post('/poses/:id/ativar', controller.ativarPose);

  router.post('/alunos/:alunoId/fotos/envios', controller.criarEnvio);
  router.post('/alunos/:alunoId/fotos', controller.confirmarEnvio);
  router.get('/alunos/:alunoId/fotos/comparar', controller.comparar);
  router.get('/alunos/:alunoId/fotos', controller.listarGaleria);

  return router;
}

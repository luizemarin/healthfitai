import {
  alunoParamsSchema,
  comparacaoResponseSchema,
  compararFotosQuerySchema,
  confirmarEnvioBodySchema,
  criarEnvioBodySchema,
  criarPoseBodySchema,
  envioResponseSchema,
  fotoResponseSchema,
  galeriaResponseSchema,
  listaPosesResponseSchema,
  listarFotosQuerySchema,
  listarPosesQuerySchema,
  poseIdParamsSchema,
  poseResponseSchema,
  renomearPoseBodySchema,
  reordenarPosesBodySchema,
} from './fotos.schemas';
import { MAX_POSES_ATIVAS } from './fotos.service';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS_POSES = ['Fotos · Poses'];
const TAGS_FOTOS = ['Fotos'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const PRIMEIRO_ACESSO =
  'Na primeira vez, o profissional recebe uma cópia das poses padrão (Frente, Perfil e Costas).';

const STORAGE = '503 STORAGE_NAO_CONFIGURADO / STORAGE_INDISPONIVEL (storage de fotos).';

const URLS =
  'As URLs são assinadas e valem poucos minutos ("urlsExpiramEm"); depois disso, busque de novo. O bucket é privado: não existe URL pública permanente.';

/** Contrato das rotas de fotos (BE-FOT-01 a BE-FOT-04). */
export function registerFotosOpenApi(registry: OpenAPIRegistry): void {
  // ─── BE-FOT-01 · Poses ────────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/poses',
    tags: TAGS_POSES,
    summary: 'Listar poses',
    description: `BE-FOT-01 · Poses do profissional, na ordem em que o app pede as fotos. ${PRIMEIRO_ACESSO}`,
    request: { headers: profissionalHeaderSchema, query: listarPosesQuerySchema },
    responses: {
      200: { description: 'Poses.', content: json(listaPosesResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/poses',
    tags: TAGS_POSES,
    summary: 'Adicionar pose',
    description: `BE-FOT-01 · A pose nova entra no fim da lista. 409 POSE_DUPLICADA (já existe uma ativa com o mesmo nome, sem diferenciar maiúsculas/acentos); 409 LIMITE_POSES (máximo de ${MAX_POSES_ATIVAS} ativas).`,
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(criarPoseBodySchema) },
    },
    responses: {
      201: { description: 'Pose criada.', content: json(poseResponseSchema) },
      ...errorResponses(400, 401, 409),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/poses/{id}',
    tags: TAGS_POSES,
    summary: 'Renomear pose',
    description:
      'BE-FOT-01 · As fotos já tiradas passam a mostrar o nome novo. 404 NOT_FOUND; 409 POSE_INATIVA; 409 POSE_DUPLICADA.',
    request: {
      headers: profissionalHeaderSchema,
      params: poseIdParamsSchema,
      body: { required: true, content: json(renomearPoseBodySchema) },
    },
    responses: {
      200: { description: 'Pose renomeada.', content: json(poseResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/poses/ordem',
    tags: TAGS_POSES,
    summary: 'Reordenar poses',
    description:
      'BE-FOT-01 · Envie TODAS as poses ativas, cada uma uma vez, na nova ordem. As desativadas vão para o fim. 400 VALIDATION_ERROR (details dizem qual id não existe/está desativado e quais poses faltaram).',
    request: {
      headers: profissionalHeaderSchema,
      body: { required: true, content: json(reordenarPosesBodySchema) },
    },
    responses: {
      200: { description: 'Poses na nova ordem.', content: json(listaPosesResponseSchema) },
      ...errorResponses(400, 401),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/poses/{id}/desativar',
    tags: TAGS_POSES,
    summary: 'Remover (desativar) pose',
    description:
      'BE-FOT-01 · A pose some do app, mas nada é apagado: as fotos antigas continuam ligadas a ela. 404 NOT_FOUND; 409 POSE_JA_INATIVA; 409 ULTIMA_POSE_ATIVA (precisa sobrar pelo menos uma).',
    request: { headers: profissionalHeaderSchema, params: poseIdParamsSchema },
    responses: {
      201: { description: 'Pose desativada.', content: json(poseResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/poses/{id}/ativar',
    tags: TAGS_POSES,
    summary: 'Reativar pose',
    description:
      'BE-FOT-01 · A pose volta no fim da lista. 404 NOT_FOUND; 409 POSE_JA_ATIVA; 409 POSE_DUPLICADA; 409 LIMITE_POSES.',
    request: { headers: profissionalHeaderSchema, params: poseIdParamsSchema },
    responses: {
      201: { description: 'Pose reativada.', content: json(poseResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  // ─── BE-FOT-02 / BE-FOT-03 · Envio ────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/fotos/envios',
    tags: TAGS_FOTOS,
    summary: 'Pedir envio de foto (passo 1)',
    description: `BE-FOT-02 · Devolve uma URL assinada (vale 10 min) para mandar o arquivo DIRETO ao storage: faça PUT na "url" com os "headers" e o arquivo no corpo. Tipo e tamanho fazem parte da assinatura: arquivo diferente do declarado é recusado pelo storage (403). Depois do PUT, envie "confirmacao" para POST /alunos/{alunoId}/fotos. 404 NOT_FOUND (aluno ou pose); 409 ALUNO_INATIVO; 409 POSE_INATIVA; 413 ARQUIVO_MUITO_GRANDE (limite do servidor, FOTO_TAMANHO_MAXIMO_MB); ${STORAGE}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(criarEnvioBodySchema) },
    },
    responses: {
      201: { description: 'URL de envio.', content: json(envioResponseSchema) },
      ...errorResponses(400, 401, 404, 409, 413, 503),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/fotos',
    tags: TAGS_FOTOS,
    summary: 'Confirmar envio (passo 2)',
    description: `BE-FOT-02/03 · Confere o arquivo enviado, processa (compressão JPEG, miniatura e remoção de EXIF/GPS) e cria a foto. Confirmar duas vezes o mesmo envio dá 404 (ele já virou foto). 404 ENVIO_NAO_ENCONTRADO (PUT não feito, expirado ou pose/data diferentes do pedido); 404 NOT_FOUND (aluno ou pose); 400 IMAGEM_INVALIDA (não é JPEG/PNG/WebP, resolução acima de 50 MP ou arquivo corrompido); 409 ALUNO_INATIVO; 409 POSE_INATIVA; 413 ARQUIVO_MUITO_GRANDE; ${STORAGE}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(confirmarEnvioBodySchema) },
    },
    responses: {
      201: { description: 'Foto criada.', content: json(fotoResponseSchema) },
      ...errorResponses(400, 401, 404, 409, 413, 503),
    },
  });

  // ─── BE-FOT-04 · Galeria e comparador ─────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/fotos',
    tags: TAGS_FOTOS,
    summary: 'Galeria do aluno (por data)',
    description: `BE-FOT-04 · Fotos agrupadas por dia e, dentro do dia, pela ordem das poses. A paginação é por DATA (pageSize = quantos dias). Aluno inativo continua consultável. ${URLS} 404 NOT_FOUND (aluno ou pose do filtro); ${STORAGE}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarFotosQuerySchema,
    },
    responses: {
      200: { description: 'Página de dias com fotos.', content: json(galeriaResponseSchema) },
      ...errorResponses(400, 401, 404, 503),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/fotos/comparar',
    tags: TAGS_FOTOS,
    summary: 'Comparador antes/depois',
    description: `BE-FOT-04 · Uma linha por pose com a foto de cada data, pronta para o slider. Se houver mais de uma foto da mesma pose no dia, vem a mais recente. Pose sem foto em nenhuma das datas não aparece. As datas disponíveis vêm da galeria. ${URLS} 404 NOT_FOUND (aluno); 404 SEM_FOTOS_NA_DATA; ${STORAGE}`,
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: compararFotosQuerySchema,
    },
    responses: {
      200: { description: 'Comparação.', content: json(comparacaoResponseSchema) },
      ...errorResponses(400, 401, 404, 503),
    },
  });
}

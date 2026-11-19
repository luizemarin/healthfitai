import {
  abrirSubmissaoBodySchema,
  alunoParamsSchema,
  finalizarSubmissaoBodySchema,
  listarSubmissoesQuerySchema,
  listaSubmissoesResponseSchema,
  salvarRascunhoBodySchema,
  submissaoParamsSchema,
  submissaoResponseSchema,
} from './respostas.schemas';
import { errorResponses } from '../../shared/errors/error.schema';
import { profissionalHeaderSchema } from '../../shared/http/profissional-atual';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

const TAGS = ['Respostas'];

function json<T>(schema: T): { 'application/json': { schema: T } } {
  return { 'application/json': { schema } };
}

const FORMATO_VALOR =
  'Formato de "valor" por tipo de pergunta: texto_curto/texto_longo/escolha_unica → texto; ' +
  'data → "AAAA-MM-DD"; numero/escala → número (respeitando min/max); sim_nao → true/false; ' +
  'multipla_escolha → lista de textos. Erros por item vêm em details ' +
  '(ex.: field "body.respostas.2.valor").';

const ERROS_ESCRITA =
  '404 NOT_FOUND (aluno ou submissão); 409 ALUNO_INATIVO; ' +
  '409 SUBMISSAO_FINALIZADA (já enviada, não muda mais).';

/** Contrato das rotas de respostas (BE-RSP-01 a BE-RSP-04). */
export function registerRespostasOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/submissoes',
    tags: TAGS,
    summary: 'Abrir ou retomar preenchimento',
    description:
      'BE-RSP-02 · Cria um rascunho do questionário para o aluno. Se já existir um ' +
      'rascunho daquele modelo, devolve o mesmo para continuar de onde parou. ' +
      'O rascunho usa a versão atual do modelo e fica nela até ser enviado. ' +
      'Avaliação é preenchida pelo profissional; anamnese e feedback, pelo aluno. ' +
      '404 NOT_FOUND (aluno ou modelo); 409 ALUNO_INATIVO; 409 MODELO_INATIVO.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      body: { required: true, content: json(abrirSubmissaoBodySchema) },
    },
    responses: {
      201: { description: 'Rascunho criado ou retomado.', content: json(submissaoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/alunos/{alunoId}/submissoes/{id}',
    tags: TAGS,
    summary: 'Salvar rascunho (autosave)',
    description:
      'BE-RSP-02 · Grava só as perguntas enviadas; as demais ficam como estão. ' +
      'valor null apaga a resposta. Obrigatórias não são cobradas aqui (só ao finalizar). ' +
      `400 VALIDATION_ERROR se algum valor não combina com a pergunta. ${ERROS_ESCRITA} ${FORMATO_VALOR}`,
    request: {
      headers: profissionalHeaderSchema,
      params: submissaoParamsSchema,
      body: { required: true, content: json(salvarRascunhoBodySchema) },
    },
    responses: {
      200: { description: 'Rascunho salvo.', content: json(submissaoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/alunos/{alunoId}/submissoes/{id}/finalizar',
    tags: TAGS,
    summary: 'Enviar respostas',
    description:
      'BE-RSP-01 · Transforma o rascunho em registro final, datado e somente leitura. ' +
      'Responder de novo depois disso cria outra submissão (nada é sobrescrito). ' +
      '"respostas" (opcional) grava as últimas alterações antes de enviar. ' +
      'BE-RSP-03 · Em avaliação, "respondidoEm" (opcional) é a data em que o profissional ' +
      'avaliou; padrão: agora. Não pode estar no futuro. ' +
      '400 RESPOSTAS_OBRIGATORIAS_PENDENTES (details lista as perguntas); ' +
      '400 DATA_RESPOSTA_NAO_PERMITIDA (data fora de avaliação). ' +
      'BE-FBK-04 · Em feedback, "feedbackId" (opcional) é o feedback respondido: ' +
      'é conferido antes de enviar e passa a "respondido" com esta submissão. ' +
      '400 VALIDATION_ERROR (feedbackId fora de feedback ou de outro modelo); ' +
      `404 NOT_FOUND (feedback); 409 FEEDBACK_JA_RESPONDIDO; 409 FEEDBACK_NAO_LIBERADO. ${ERROS_ESCRITA}`,
    request: {
      headers: profissionalHeaderSchema,
      params: submissaoParamsSchema,
      body: { required: false, content: json(finalizarSubmissaoBodySchema) },
    },
    responses: {
      201: { description: 'Respostas enviadas.', content: json(submissaoResponseSchema) },
      ...errorResponses(400, 401, 404, 409),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/submissoes',
    tags: TAGS,
    summary: 'Histórico de respostas do aluno',
    description:
      'BE-RSP-04 · Só respostas enviadas (rascunho não entra). Filtros por tipo, modelo e ' +
      'período (de/ate sobre a data da resposta, com fuso). Padrão: mais recentes primeiro. ' +
      'Aluno inativo continua consultável. 404 NOT_FOUND se o aluno não existe.',
    request: {
      headers: profissionalHeaderSchema,
      params: alunoParamsSchema,
      query: listarSubmissoesQuerySchema,
    },
    responses: {
      200: { description: 'Página do histórico.', content: json(listaSubmissoesResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/alunos/{alunoId}/submissoes/{id}',
    tags: TAGS,
    summary: 'Detalhar respostas',
    description:
      'Perguntas da versão que foi respondida, cada uma com o valor dado (null = sem resposta). ' +
      'Serve para exibir uma resposta enviada e para retomar um rascunho. ' +
      '404 NOT_FOUND (aluno ou submissão).',
    request: { headers: profissionalHeaderSchema, params: submissaoParamsSchema },
    responses: {
      200: { description: 'Submissão.', content: json(submissaoResponseSchema) },
      ...errorResponses(400, 401, 404),
    },
  });
}

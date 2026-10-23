import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';

import { createOpenApiDocument } from './openapi';

/**
 * Gera e valida o contrato em apps/api/openapi.json (arquivo versionado).
 *   npm run openapi:generate → valida e grava o arquivo
 *   npm run openapi:check    → valida e falha se o arquivo estiver desatualizado
 */
const OUTPUT_PATH = path.resolve(__dirname, '..', 'openapi.json');

type ParserInput = Exclude<Parameters<typeof SwaggerParser.validate>[0], string>;

async function readCurrent(): Promise<string | undefined> {
  try {
    return await readFile(OUTPUT_PATH, 'utf8');
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const document = createOpenApiDocument();
  const content = `${JSON.stringify(document, null, 2)}\n`;

  // Valida exatamente o que vai para o arquivo (o validate também altera o objeto recebido).
  await SwaggerParser.validate(JSON.parse(content) as ParserInput);

  if (process.argv.includes('--check')) {
    if ((await readCurrent()) !== content) {
      process.stderr.write('openapi.json desatualizado. Rode: npm run openapi:generate\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write('openapi.json válido e atualizado.\n');
    return;
  }

  await writeFile(OUTPUT_PATH, content);
  process.stdout.write(`Contrato válido gravado em ${OUTPUT_PATH}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Contrato OpenAPI inválido: ${String(error)}\n`);
  process.exitCode = 1;
});

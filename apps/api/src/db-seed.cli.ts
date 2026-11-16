import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

/**
 * Seeds (dados iniciais). Ficam em prisma/seeds/<pasta>/, separados das
 * migrations (que só mudam a estrutura). Cada pasta tem:
 *   seed.sql → insere os dados (idempotente: rodar de novo não duplica)
 *   down.sql → remove o que o seed.sql inseriu
 * Rodar a partir de apps/api ou da raiz:
 *
 *   npm run db:seed            → roda todos os seed.sql, em ordem (0021, 0022...)
 *   npm run db:seed:rollback   → roda todos os down.sql, na ordem inversa
 *
 * Rode depois de "npm run db:migrate": o seed precisa das tabelas.
 *
 * Segurança: o rollback APAGA dados. Por isso só roda em banco local
 * (localhost/127.0.0.1). Para outro banco, é preciso passar --force.
 * O seed em si não apaga nada e pode rodar em qualquer banco.
 */
const SEEDS_DIR = path.join('prisma', 'seeds');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Barra rollback fora do banco local, a menos que venha --force. */
function getDatabaseUrl(rollback: boolean, force: boolean): string {
  const url = process.env['DATABASE_URL'];
  if (url === undefined) throw new Error('DATABASE_URL não definida (confira o .env).');

  const { hostname } = new URL(url);
  if (rollback && !LOCAL_HOSTS.has(hostname) && !force) {
    throw new Error(
      `Banco "${hostname}" não é local. O rollback apaga dados; use --force se tiver certeza.`,
    );
  }
  return url;
}

/** Pastas de seed em ordem (o prefixo numérico define a ordem). */
async function listSeeds(): Promise<string[]> {
  const entries = await readdir(SEEDS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Roda um arquivo .sql. Ele tem BEGIN/COMMIT: ou aplica tudo, ou nada. */
async function runFile(client: Client, seed: string, file: string): Promise<void> {
  const sql = await readFile(path.join(SEEDS_DIR, seed, file), 'utf8');

  process.stdout.write(`${file === 'down.sql' ? '↩ ' : '🌱'} ${seed}\n`);
  try {
    await client.query(sql);
  } catch (error) {
    // Se o erro veio no meio da transação, garante que nada fica pela metade.
    await client.query('ROLLBACK');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Falhou em ${seed}/${file}: ${reason}\nParei aqui.`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rollback = args.includes('--rollback');
  const force = args.includes('--force');

  // Rollback desfaz do mais novo para o mais antigo (dependência entre seeds).
  const seeds = await listSeeds();
  if (rollback) seeds.reverse();
  const file = rollback ? 'down.sql' : 'seed.sql';

  const client = new Client({ connectionString: getDatabaseUrl(rollback, force) });
  await client.connect();

  try {
    // Um de cada vez e em ordem; se um falhar, os seguintes não rodam.
    await seeds.reduce(
      async (previous, seed) => previous.then(async () => runFile(client, seed, file)),
      Promise.resolve(),
    );
    process.stdout.write(rollback ? 'Seeds removidos.\n' : 'Seeds aplicados.\n');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

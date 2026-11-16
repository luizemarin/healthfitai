import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

/**
 * Rollback de migrations (o Prisma não tem "migrate down"): roda o down.sql
 * das migrations APLICADAS, da mais nova para a mais antiga.
 * Rodar a partir de apps/api ou da raiz:
 *
 *   npm run db:rollback                     → desfaz a última aplicada
 *   npm run db:rollback -- 3                → desfaz as 3 últimas aplicadas
 *   npm run db:rollback -- <nome_da_pasta>  → desfaz da última até essa (inclusive)
 *
 * Depois, "npm run db:migrate" aplica de novo.
 *
 * Quem diz o que está aplicado é a tabela _prisma_migrations (cada down.sql
 * apaga a sua linha de lá). Assim, rodar duas vezes seguidas desfaz duas
 * migrations diferentes, nunca a mesma duas vezes.
 *
 * Segurança: o down.sql APAGA dados. Por isso só roda em banco local
 * (localhost/127.0.0.1). Para outro banco, é preciso passar --force.
 */
const MIGRATIONS_DIR = path.join('prisma', 'migrations');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Barra rollback fora do banco local, a menos que venha --force. */
function getDatabaseUrl(force: boolean): string {
  const url = process.env['DATABASE_URL'];
  if (url === undefined) throw new Error('DATABASE_URL não definida (confira o .env).');

  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname) && !force) {
    throw new Error(
      `Banco "${hostname}" não é local. O rollback apaga dados; use --force se tiver certeza.`,
    );
  }
  return url;
}

/** Migrations aplicadas com sucesso, da mais nova para a mais antiga. */
async function listApplied(client: Client): Promise<string[]> {
  const result = await client.query<{ migration_name: string }>(
    `SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC`,
  );
  return result.rows.map((row) => row.migration_name);
}

/** Decide quais desfazer a partir do argumento (já vem mais nova primeiro). */
function selectMigrations(applied: string[], arg: string | undefined): string[] {
  // Sem argumento: só a última.
  if (arg === undefined) return applied.slice(0, 1);

  // Número: as N últimas.
  if (/^\d+$/.test(arg)) {
    const count = Number(arg);
    if (count < 1) throw new Error('Informe um número maior que zero.');
    return applied.slice(0, count);
  }

  // Nome: da última até ela, inclusive (respeita as dependências entre tabelas).
  const index = applied.indexOf(arg);
  if (index === -1) throw new Error(`Migration não está aplicada (ou não existe): ${arg}`);
  return applied.slice(0, index + 1);
}

/** Roda o down.sql de uma migration. Ele tem BEGIN/COMMIT: ou desfaz tudo, ou nada. */
async function runDown(client: Client, migration: string): Promise<void> {
  const file = path.join(MIGRATIONS_DIR, migration, 'down.sql');

  let sql: string;
  try {
    sql = await readFile(file, 'utf8');
  } catch {
    throw new Error(`Sem down.sql em ${migration}. Parei aqui.`);
  }

  process.stdout.write(`↩  ${migration}\n`);
  try {
    await client.query(sql);
  } catch (error) {
    // Se o erro veio no meio da transação, garante que nada fica pela metade.
    await client.query('ROLLBACK');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Falhou em ${migration}: ${reason}\nParei aqui; as anteriores já foram desfeitas.`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const target = args.find((value) => value !== '--force');

  const client = new Client({ connectionString: getDatabaseUrl(force) });
  await client.connect();

  try {
    const selected = selectMigrations(await listApplied(client), target);
    if (selected.length === 0) {
      process.stdout.write('Nenhuma migration aplicada. Nada a desfazer.\n');
      return;
    }

    process.stdout.write(
      `Desfazendo ${String(selected.length)} migration(s), da mais nova para a mais antiga:\n`,
    );

    // Uma de cada vez e em ordem (dependência entre tabelas): a próxima só
    // começa depois que a anterior terminou; se uma falhar, as seguintes não rodam.
    await selected.reduce(
      async (previous, migration) => previous.then(async () => runDown(client, migration)),
      Promise.resolve(),
    );

    process.stdout.write('Rollback concluído. Para aplicar de novo: npm run db:migrate\n');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

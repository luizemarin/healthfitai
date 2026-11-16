import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // DB-021: dados iniciais (modelos e poses padrão). Roda com "npm run db:seed"
    // e também sozinho depois de "prisma migrate reset".
    seed: 'tsx --env-file-if-exists=.env src/db-seed.cli.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

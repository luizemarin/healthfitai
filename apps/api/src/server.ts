import { createApp } from './app';
import { EnvValidationError, parseEnv } from './config/env';

import type { Env } from './config/env';

function loadEnv(): Env | undefined {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(`${error.message}\n`);
      return undefined;
    }
    throw error;
  }
}

function bootstrap(): void {
  const env = loadEnv();

  if (!env) {
    process.exitCode = 1;
    return;
  }

  const app = createApp(env);

  // No Express 5 o callback do listen recebe o erro de bind (ex.: EADDRINUSE).
  app.listen(env.PORT, env.HOST, (error) => {
    if (error) {
      process.stderr.write(`Falha ao iniciar o servidor HTTP: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`API no ar em http://${env.HOST}:${env.PORT} (${env.NODE_ENV}) 🚀 \n`);
  });
}

bootstrap();

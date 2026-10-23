import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Prefixo '' carrega também variáveis sem VITE_ (ficam só aqui, não vão para o navegador).
  const env = loadEnv(mode, '.', '');
  const apiTarget = env['API_PROXY_TARGET'] ?? 'http://localhost:3333';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Em dev o navegador chama /api/* e o Vite repassa para a API sem o prefixo.
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});

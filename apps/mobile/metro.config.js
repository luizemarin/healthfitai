const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * Metro (bundler do Expo) + NativeWind: compila as classes Tailwind usadas em src/ para estilos
 * nativos. Caminhos absolutos para funcionar rodando da raiz do monorepo ou de apps/mobile.
 */
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: path.join(__dirname, 'src/theme/global.css'),
  configPath: path.join(__dirname, 'tailwind.config.ts'),
  // Os tipos do className já estão em src/nativewind-env.d.ts: não deixar o NativeWind editar o tsconfig.
  disableTypeScriptGeneration: true,
});

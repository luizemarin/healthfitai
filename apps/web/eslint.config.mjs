import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import { configs, plugins, rules } from 'eslint-config-airbnb-extended';
import prettierConfig from 'eslint-config-prettier';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const gitignorePath = path.resolve(dirname, '../../.gitignore');

export default [
  includeIgnoreFile(gitignorePath),
  // Tipos gerados a partir do OpenAPI (npm run api:types): não editar à mão.
  { name: 'project/ignores', ignores: ['src/api/generated/**'] },

  // Airbnb (JS base + React)
  { name: 'js/config', ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  plugins.react,
  plugins.reactA11y,
  plugins.reactHooks,
  ...configs.react.recommended,
  rules.base.importsStrict,

  // TypeScript (com type-checking via project service)
  plugins.typescriptEslint,
  ...configs.react.typescript,
  rules.typescript.typescriptEslintStrict,
  {
    name: 'project/typescript-parser',
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname,
      },
    },
  },

  // Ajustes do projeto
  {
    name: 'project/rules',
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Named exports facilitam refactor e busca; default export não é obrigatório.
      'import-x/prefer-default-export': 'off',
      // Novo JSX transform (React 17+): não precisa importar React em cada arquivo.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // A versão do typescript-eslint entende tipos (ex.: parâmetros em assinaturas de função).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    name: 'project/config-files',
    files: ['*.config.{ts,mjs,js}'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },

  // Prettier por último: desliga regras de formatação que conflitam.
  { name: 'prettier/config', ...prettierConfig },
];

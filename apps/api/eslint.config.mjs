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

  // Airbnb (JS base)
  { name: 'js/config', ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  rules.base.importsStrict,

  // Node
  plugins.node,
  ...configs.node.recommended,

  // TypeScript (com type-checking via project service)
  plugins.typescriptEslint,
  ...configs.base.typescript,
  rules.typescript.typescriptEslintStrict,
  {
    name: 'project/typescript-parser',
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Arquivos de config fora do tsconfig (ex.: prisma.config.ts).
          allowDefaultProject: ['*.config.ts'],
        },
        tsconfigRootDir: dirname,
      },
    },
  },

  // Ajustes do projeto
  {
    name: 'project/rules',
    files: ['**/*.ts'],
    rules: {
      // Named exports facilitam refactor e busca; default export não é obrigatório.
      'import-x/prefer-default-export': 'off',
    },
  },
  {
    name: 'project/config-files',
    // Configs e scripts de linha de comando (*.cli.ts) podem usar devDependencies.
    files: ['*.config.{ts,mjs,js}', 'src/**/*.cli.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },

  // Prettier por último: desliga regras de formatação que conflitam.
  { name: 'prettier/config', ...prettierConfig },
];

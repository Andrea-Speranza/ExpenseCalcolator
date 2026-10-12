// @ts-check
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Ogni linguaggio usa il set raccomandato dal suo plugin ufficiale. Le regole di JavaScript e
// TypeScript sono limitate ai file di codice, perché non si applicano a JSON e Markdown.
const CODE_FILES = ['**/*.{js,mjs,cjs,ts,mts,cts}'];
const JS_FILES = ['**/*.{js,mjs,cjs}'];
const TEST_FILES = ['packages/**/test/**/*.ts'];
// JSON con commenti: i tsconfig e le impostazioni di VS Code.
const JSONC_FILES = ['**/tsconfig*.json', '.vscode/*.json'];

// Pacchetti che devono dare lo stesso risultato su ogni dispositivo (PLANNING §4.2):
// l'ora di sistema e la casualità arrivano dall'esterno tramite le porte Clock e IdGenerator.
const PLATFORM_AGNOSTIC_SOURCES = ['packages/{schema,core,sync,engine}/src/**/*.ts'];
const CLOCK_MESSAGE = "Usa la porta Clock: questo codice non deve leggere l'ora di sistema.";

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', 'spec/schemas/']),

  // JavaScript e TypeScript: raccomandazioni di ESLint e di typescript-eslint nella versione più
  // completa (strict + stylistic, con controllo dei tipi), come suggerito dalla documentazione.
  {
    files: CODE_FILES,
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Fuori dai set predefiniti ma consigliata da typescript-eslint: ogni `switch` su un'unione
      // (es. tipi di evento, codici di errore) deve gestire tutti i casi.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: JS_FILES,
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: PLATFORM_AGNOSTIC_SOURCES,
    rules: {
      // API pubbliche dei pacchetti condivisi: tipi espliciti in ingresso e in uscita.
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: CLOCK_MESSAGE },
        {
          object: 'Math',
          property: 'random',
          message: 'Usa la porta IdGenerator: il risultato deve essere deterministico.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: CLOCK_MESSAGE,
        },
      ],
    },
  },
  {
    files: TEST_FILES,
    extends: [vitest.configs.recommended],
  },
  {
    files: CODE_FILES,
    extends: [prettier],
  },

  // JSON
  {
    files: ['**/*.json'],
    ignores: JSONC_FILES,
    language: 'json/json',
    extends: [json.configs.recommended],
  },
  {
    files: JSONC_FILES,
    language: 'json/jsonc',
    extends: [json.configs.recommended],
  },

  // Markdown (dialetto GitHub, quello in cui vengono letti i documenti)
  {
    files: ['**/*.md'],
    language: 'markdown/gfm',
    extends: [markdown.configs.recommended],
  },
);

// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Pacchetti che devono dare lo stesso risultato su ogni dispositivo (PLANNING §4.2):
// l'ora di sistema e la casualità arrivano dall'esterno tramite le porte Clock e IdGenerator.
const PLATFORM_AGNOSTIC_SOURCES = ['packages/{schema,core,sync,engine}/src/**/*.ts'];
const CLOCK_MESSAGE = "Usa la porta Clock: questo codice non deve leggere l'ora di sistema.";

export default defineConfig(
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/', 'spec/schemas/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: PLATFORM_AGNOSTIC_SOURCES,
    rules: {
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
  prettier,
);

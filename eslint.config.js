// @ts-check
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// Ogni linguaggio usa il set raccomandato dal suo plugin ufficiale. Le regole di JavaScript e
// TypeScript sono limitate ai file di codice, perché non si applicano a JSON e Markdown.
const CODE_FILES = ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'];
const JS_FILES = ['**/*.{js,mjs,cjs}'];
const TEST_FILES = ['{packages,apps}/**/test/**/*.{ts,tsx}'];
// Codice React: la UI condivisa e la shell web.
const REACT_FILES = ['{packages/ui,apps/web}/src/**/*.{ts,tsx}'];
// JSON con commenti: i tsconfig e le impostazioni di VS Code.
const JSONC_FILES = ['**/tsconfig*.json', '.vscode/*.json'];

// Pacchetti che devono dare lo stesso risultato su ogni dispositivo (PLANNING §4.2):
// l'ora di sistema e la casualità arrivano dall'esterno tramite le porte Clock e IdGenerator.
const PLATFORM_AGNOSTIC_SOURCES = ['packages/{schema,core,sync,engine,i18n}/src/**/*.ts'];
const CLOCK_MESSAGE = "Usa la porta Clock: questo codice non deve leggere l'ora di sistema.";
// Codice della UI che mostra testi: devono arrivare dai dizionari (ADR 0010).
const LOCALIZED_SOURCES = ['packages/ui/src/**/*.tsx'];
const TEXT_MESSAGE =
  'Testo per l’utente scritto nel codice: aggiungilo ai dizionari e usa t(K.…) (ADR 0010).';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/test-results/',
    '**/playwright-report/',
    // Generati da Cargo e da Tauri (apps/native).
    '**/target/',
    'apps/native/src-tauri/gen/',
    'spec/schemas/',
  ]),

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
  // React: regole ufficiali degli hook (comprese quelle del React Compiler) e, come nel modello React di
  // Vite, file di componenti compatibili con l'aggiornamento a caldo.
  {
    files: REACT_FILES,
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Componenti generati da shadcn/ui (ADR 0008): si aggiornano con la sua CLI, quindi non si correggono a
    // mano. Si disattivano solo le regole che lo stile di shadcn non segue per scelta (es. esportare le
    // varianti uttonVariants accanto al componente). TypeScript li controlla comunque in modalità strict.
    files: ['packages/ui/src/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    // Nessun testo per l'utente scritto direttamente nei componenti: né nel JSX né negli attributi letti dai
    // lettori di schermo o mostrati nei campi. E nessuna chiave scritta a mano: t('groups.title') non viene
    // controllata dal compilatore, t(K.groups.title) sì. La punteggiatura (·, →, …) resta libera.
    files: LOCALIZED_SOURCES,
    ignores: ['packages/ui/src/components/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'JSXText[value=/[A-Za-zÀ-ÿ]/]', message: TEXT_MESSAGE },
        {
          selector:
            'JSXAttribute[name.name=/^(aria-label|placeholder|title|alt)$/] > Literal[value=/[A-Za-zÀ-ÿ]/]',
          message: TEXT_MESSAGE,
        },
        {
          selector:
            "CallExpression[callee.name='t'][arguments.0.type=/^(Literal|TemplateLiteral)$/]",
          message: 'Usa le chiavi tipizzate: t(K.sezione.testo), non una stringa (ADR 0010).',
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

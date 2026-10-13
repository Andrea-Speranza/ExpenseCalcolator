import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // I test della UI che usano il DOM lo dichiarano in testa al file (@vitest-environment jsdom).
    include: ['{packages,apps}/**/test/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.{ts,tsx}'],
      // Componenti generati da shadcn/ui (ADR 0008): non sono codice nostro.
      exclude: ['packages/ui/src/components/ui/**'],
      reporter: ['text', 'html'],
      thresholds: {
        // PLANNING §11.3: il core deve avere una copertura di almeno il 95%.
        'packages/core/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});

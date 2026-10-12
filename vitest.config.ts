import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        // PLANNING §11.3: il core deve avere una copertura di almeno il 95%.
        'packages/core/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});

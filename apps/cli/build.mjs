// Crea dist/spese.mjs: un unico file eseguibile con Node, senza bisogno del resto del repository.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/spese.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: '#!/usr/bin/env node' },
  // Quasi tutto il peso è Zod con tutte le sue lingue: minimizzare riduce il file di circa il 40%.
  minify: true,
  logLevel: 'warning',
});

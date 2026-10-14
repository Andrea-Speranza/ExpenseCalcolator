// Grafico delle dipendenze tra i pacchetti, generato da dependency-cruiser in formato Mermaid e inserito in
// docs/ARCHITETTURA.md tra due commenti. GitHub e VS Code lo mostrano come diagramma, senza installare nulla.
//   node scripts/deps-graph.mjs          aggiorna il documento (pnpm deps:graph)
//   node scripts/deps-graph.mjs --check  fallisce se il grafico nel documento non è aggiornato (pnpm deps)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const DOCUMENT = 'docs/ARCHITETTURA.md';
const START = '<!-- grafico-dipendenze:inizio (generato: pnpm deps:graph) -->';
const END = '<!-- grafico-dipendenze:fine -->';

const result = spawnSync(
  process.execPath,
  [
    join('node_modules', 'dependency-cruiser', 'bin', 'dependency-cruiser.mjs'),
    'packages',
    'apps',
    '--config',
    '.dependency-cruiser.mjs',
    // Solo i pacchetti del progetto (niente librerie npm), senza test e file di configurazione.
    '--include-only',
    '^(packages|apps)/',
    '--exclude',
    '(^|/)(test|e2e)/|\\.config\\.ts$',
    // Un nodo per pacchetto invece che per file.
    '--collapse',
    '^(packages/(adapters|channels)/[^/]+|packages/[^/]+|apps/[^/]+)',
    '--output-type',
    'mermaid',
  ],
  { encoding: 'utf8' },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const graph = `${START}\n\n\`\`\`mermaid\n${result.stdout.trim()}\n\`\`\`\n\n${END}`;
const document = readFileSync(DOCUMENT, 'utf8');
const start = document.indexOf(START);
const end = document.indexOf(END);
if (start < 0 || end < start) {
  process.stderr.write(`In ${DOCUMENT} mancano i commenti che delimitano il grafico.\n`);
  process.exit(1);
}
const updated = document.slice(0, start) + graph + document.slice(end + END.length);

if (process.argv.includes('--check')) {
  if (updated !== document) {
    process.stderr.write(
      `Il grafico delle dipendenze in ${DOCUMENT} non è aggiornato: esegui pnpm deps:graph.\n`,
    );
    process.exit(1);
  }
} else if (updated !== document) {
  writeFileSync(DOCUMENT, updated);
  process.stdout.write(`Grafico aggiornato in ${DOCUMENT}.\n`);
}

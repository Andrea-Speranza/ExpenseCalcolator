import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { openEngine } from '@expense/engine';
import { openFileStore } from '@expense/local-file';
import { createSystemClock, createUlidGenerator } from '@expense/system';
import { z } from 'zod';
import { it } from 'zod/locales';
import { run } from './cli';
import type { CliEnvironment } from './environment';

// Messaggi di validazione dei dati in italiano. Zod è lo stesso usato dall'engine (stessa versione nel
// workspace), quindi la configurazione vale anche per i suoi schemi. Si importa solo la lingua italiana.
z.config(it());

// Con `pnpm cli` lo script parte dalla radice del repository: i percorsi relativi vanno risolti rispetto
// alla cartella da cui l'utente ha lanciato il comando (INIT_CWD, impostata da pnpm).
const baseDir = process.env['INIT_CWD'] ?? process.cwd();

/** Cartella dei dati predefinita, quella delle applicazioni dell'utente su ogni sistema operativo. */
function defaultDataDirectory(): string {
  const fromEnvironment = process.env['SPESE_DATI'];
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  if (process.platform === 'win32') {
    return join(
      process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'),
      'ExpenseCalcolator',
    );
  }
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'ExpenseCalcolator');
  return join(
    process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share'),
    'expense-calcolator',
  );
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const environment: CliEnvironment = {
  readFile: (path) => readFile(resolve(baseDir, path), 'utf8'),
  writeFile: (path, content) => writeFile(resolve(baseDir, path), content, 'utf8'),
  async openEngine(dataDirectory) {
    const directory =
      dataDirectory === undefined ? defaultDataDirectory() : resolve(baseDir, dataDirectory);
    const clock = createSystemClock();
    return openEngine({
      store: await openFileStore({ directory }),
      clock,
      ids: createUlidGenerator(clock),
    });
  },
  today,
};

const result = await run(process.argv.slice(2), environment);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;

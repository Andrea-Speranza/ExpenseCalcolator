import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { it } from 'zod/locales';
import { run } from './cli';

// Messaggi di validazione dei dati in italiano. Zod è lo stesso usato dall'engine (stessa versione nel
// workspace), quindi la configurazione vale anche per i suoi schemi. Si importa solo la lingua italiana,
// così il file della CLI non contiene tutte le altre.
z.config(it());

// Con `pnpm cli` lo script parte dalla radice del repository: i percorsi relativi vanno risolti rispetto
// alla cartella da cui l'utente ha lanciato il comando (INIT_CWD, impostata da pnpm).
const baseDir = process.env['INIT_CWD'] ?? process.cwd();

const result = run(process.argv.slice(2), (path) => readFileSync(resolve(baseDir, path), 'utf8'));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;

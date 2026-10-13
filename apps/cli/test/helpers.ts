import {
  createManualClock,
  createMemoryStore,
  createSequentialIds,
  type Engine,
  openEngine,
} from '@expense/engine';
import { z } from 'zod';
import { it as italian } from 'zod/locales';
import { type CliResult, run } from '../src/cli';
import type { CliEnvironment } from '../src/environment';

z.config(italian());

/** Gli spazi non separabili che Intl mette negli importi diventano spazi normali, per confrontare il testo. */
const normalize = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

export interface TestCli {
  /** Esegue la CLI come da terminale: `cli('saldi', 'Weekend')`. */
  (...args: string[]): Promise<CliResult>;
  readonly engine: Engine;
  /** File "su disco": letti da `importa`/`registro`, scritti da `esporta`. */
  readonly files: Map<string, string>;
}

/** Una CLI con dati in memoria (un engine vero), file simulati e "oggi" fisso al 13/10/2026. */
export async function testCli(files = new Map<string, string>(), name = 'x'): Promise<TestCli> {
  const engine = await openEngine({
    store: createMemoryStore(),
    clock: createManualClock(),
    ids: createSequentialIds(name),
  });
  const env: CliEnvironment = {
    readFile: (path) => {
      const content = files.get(path);
      return content === undefined
        ? Promise.reject(new Error('file inesistente'))
        : Promise.resolve(content);
    },
    writeFile: (path, content) => {
      files.set(path, content);
      return Promise.resolve();
    },
    openEngine: () => Promise.resolve(engine),
    today: () => '2026-10-13',
  };
  const cli = async (...args: string[]) => {
    const result = await run(args, env);
    return { ...result, stdout: normalize(result.stdout), stderr: normalize(result.stderr) };
  };
  return Object.assign(cli, { engine, files });
}

/** Il gruppo "Weekend" con Anna (io), Luca e Sara. */
export async function weekend(): Promise<TestCli> {
  const cli = await testCli();
  await cli('gruppo', 'crea', 'Weekend', '--io', 'Anna');
  await cli('membro', 'aggiungi', 'Weekend', 'Luca');
  await cli('membro', 'aggiungi', 'Weekend', 'Sara');
  return cli;
}

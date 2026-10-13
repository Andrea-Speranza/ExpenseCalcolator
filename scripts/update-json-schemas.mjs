// Rigenera spec/schemas dai modelli di packages/schema (ADR 0003), eseguendo il test che li confronta
// in modalità "aggiornamento".
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'packages/schema/test/json-schema.test.ts'],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, UPDATE_SCHEMAS: '1' },
  },
);
process.exit(result.status ?? 1);

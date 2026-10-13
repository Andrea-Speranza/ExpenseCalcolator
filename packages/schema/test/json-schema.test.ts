import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CommandSchema,
  ExchangeFileSchema,
  GroupEventSchema,
  LedgerSchema,
  ProfileEventSchema,
  StoredEventSchema,
} from '../src/index';

// Il JSON Schema in spec/schemas è generato da questi schemi, mai scritto a mano (ADR 0003): è il contratto
// pubblico dei dati salvati e scambiati, da cui si possono generare modelli in altri linguaggi.
// Per rigenerarlo: `pnpm schemas`. Questo test fallisce se i file non sono aggiornati.

const SCHEMAS = {
  'stored-event': StoredEventSchema,
  'group-event': GroupEventSchema,
  'profile-event': ProfileEventSchema,
  ledger: LedgerSchema,
  command: CommandSchema,
  'exchange-file': ExchangeFileSchema,
};

const DIRECTORY = join(import.meta.dirname, '../../../spec/schemas');
const update = process.env['UPDATE_SCHEMAS'] === '1';

describe('spec/schemas', () => {
  it.each(Object.entries(SCHEMAS))('%s.schema.json è aggiornato', (name, schema) => {
    const generated = `${JSON.stringify(z.toJSONSchema(schema, { io: 'input' }), null, 2)}\n`;
    const file = join(DIRECTORY, `${name}.schema.json`);
    if (update) writeFileSync(file, generated);
    expect(readFileSync(file, 'utf8')).toBe(generated);
  });
});

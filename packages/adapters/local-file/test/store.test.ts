import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StoredEvent } from '@expense/engine';
import { describeLocalStoreContract } from '@expense/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DATA_FILE, openFileStore } from '../src/index';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'spese-test-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describeLocalStoreContract('file JSON', {
  async create() {
    const directory = await temporaryDirectory();
    const store = await openFileStore({ directory });
    return { store, reopen: () => openFileStore({ directory }) };
  },
});

const device = { deviceId: 'd_1', profileId: 'p_1', clock: { wallTime: 10, counter: 0 } };
const event = (id: string): StoredEvent => ({
  id,
  stream: 'g_1',
  type: 'MemberAdded',
  v: 1,
  hlc: '0000000000010:00000:d_1',
  deviceId: 'd_1',
  actor: null,
  payload: { memberId: `m_${id}`, name: id },
});

describe('openFileStore', () => {
  it('crea la cartella dei dati se non esiste', async () => {
    const directory = join(await temporaryDirectory(), 'nuova', 'cartella');
    const store = await openFileStore({ directory });
    await store.save([], device);
    expect(await readdir(directory)).toEqual([DATA_FILE]);
  });

  it('due finestre aperte sugli stessi dati non si cancellano gli eventi a vicenda', async () => {
    const directory = await temporaryDirectory();
    const first = await openFileStore({ directory });
    const second = await openFileStore({ directory });
    await first.save([event('e_1')], { ...device, clock: { wallTime: 30, counter: 0 } });
    await second.save([event('e_2')], { ...device, clock: { wallTime: 20, counter: 5 } });
    const reopened = await openFileStore({ directory });
    expect((await reopened.loadEvents()).length).toBe(2);
    // L'orologio salvato è il più avanti dei due: non torna mai indietro.
    expect((await reopened.loadDevice())?.clock).toEqual({ wallTime: 30, counter: 0 });
  });

  it('segnala un file dei dati con un formato non riconosciuto', async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, DATA_FILE), '{"format": 99}', 'utf8');
    const store = await openFileStore({ directory });
    await expect(store.loadEvents()).rejects.toThrow('non ha il formato previsto');
  });
});

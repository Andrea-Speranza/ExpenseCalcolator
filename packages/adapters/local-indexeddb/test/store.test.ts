import { createMemoryStore } from '@expense/engine';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { describeLocalStoreContract } from '@expense/testing';
import { openIndexedDbStore } from '../src/index';

let databases = 0;

describeLocalStoreContract('in memoria (engine)', {
  create() {
    const store = createMemoryStore();
    return Promise.resolve({ store, reopen: () => Promise.resolve(store) });
  },
});

describeLocalStoreContract('IndexedDB', {
  async create() {
    const indexedDB = new IDBFactory();
    databases += 1;
    const name = `test-${String(databases)}`;
    const store = await openIndexedDbStore({ indexedDB, name });
    return {
      store,
      reopen() {
        store.close();
        return openIndexedDbStore({ indexedDB, name });
      },
    };
  },
});

describe('openIndexedDbStore', () => {
  it('ignora un dispositivo salvato in un formato non riconosciuto', async () => {
    const indexedDB = new IDBFactory();
    const store = await openIndexedDbStore({ indexedDB, name: 'rotto' });
    await store.save([], { deviceId: 'd_1', profileId: 'p_1', clock: { wallTime: 1, counter: 0 } });
    store.close();

    // Corrompe il record del dispositivo scrivendo direttamente nel database.
    const db = await new Promise<IDBDatabase>((resolve) => {
      const opening = indexedDB.open('rotto', 1);
      opening.onsuccess = () => {
        resolve(opening.result);
      };
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({ deviceId: 42 }, 'device');
      transaction.oncomplete = () => {
        resolve();
      };
    });
    db.close();

    const reopened = await openIndexedDbStore({ indexedDB, name: 'rotto' });
    expect(await reopened.loadDevice()).toBeUndefined();
  });
});

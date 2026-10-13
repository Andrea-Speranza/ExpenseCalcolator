import type { DeviceRecord, LocalStore } from '@expense/engine';

// Salvataggio locale su IndexedDB (PLANNING §8.10): lo stesso codice vale su web, Windows (WebView2) e
// Android (System WebView). Eventi e identità del dispositivo si scrivono nella stessa transazione
// (ADR 0007, punto 9).

export interface IndexedDbStoreOptions {
  /** Nome del database. */
  readonly name?: string;
  /** Implementazione di IndexedDB: quella della piattaforma o, nei test, una simulata. */
  readonly indexedDB?: IDBFactory;
}

export interface IndexedDbStore extends LocalStore {
  close(): void;
}

const VERSION = 1;
const EVENTS = 'events';
const META = 'meta';
const DEVICE_KEY = 'device';

export async function openIndexedDbStore(
  options: IndexedDbStoreOptions = {},
): Promise<IndexedDbStore> {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const db = await openDatabase(factory, options.name ?? 'expense-calcolator');
  return {
    async loadDevice() {
      const value = await request(
        db.transaction(META, 'readonly').objectStore(META).get(DEVICE_KEY) as IDBRequest<unknown>,
      );
      return isDeviceRecord(value) ? value : undefined;
    },
    loadEvents() {
      return request(
        db.transaction(EVENTS, 'readonly').objectStore(EVENTS).getAll() as IDBRequest<unknown[]>,
      );
    },
    save(events, device) {
      const transaction = db.transaction([EVENTS, META], 'readwrite');
      const finished = completion(transaction);
      // Gli eventi sono immutabili: riscrivere lo stesso id non cambia nulla.
      const store = transaction.objectStore(EVENTS);
      for (const event of events) store.put(event);
      transaction.objectStore(META).put(device, DEVICE_KEY);
      return finished;
    },
    close() {
      db.close();
    },
  };
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(name, VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains(EVENTS)) db.createObjectStore(EVENTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    opening.onsuccess = () => {
      resolve(opening.result);
    };
    opening.onerror = () => {
      reject(opening.error ?? new Error(`Impossibile aprire il database "${name}".`));
    };
  });
}

function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.onsuccess = () => {
      resolve(pending.result);
    };
    pending.onerror = () => {
      reject(pending.error ?? new Error('Lettura dal database non riuscita.'));
    };
  });
}

/** La transazione è riuscita solo quando è completata: se fallisce o viene annullata, non resta nulla. */
function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('Salvataggio non riuscito.'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('Salvataggio annullato.'));
    };
  });
}

function isDeviceRecord(value: unknown): value is DeviceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const { deviceId, profileId, clock } = value as Partial<Record<keyof DeviceRecord, unknown>>;
  if (typeof deviceId !== 'string' || typeof profileId !== 'string') return false;
  if (typeof clock !== 'object' || clock === null) return false;
  const { wallTime, counter } = clock as Partial<Record<'wallTime' | 'counter', unknown>>;
  return typeof wallTime === 'number' && typeof counter === 'number';
}

import type { StoredEvent } from '@expense/schema';
import type { Clock, DeviceRecord, IdGenerator, LocalStore } from './ports';

// Implementazioni in memoria delle porte: per i test, per le simulazioni con più dispositivi e per usi senza
// salvataggio (es. una sessione temporanea). Funzionano su qualsiasi piattaforma.

/** Salvataggio in memoria. Si può riaprire con un nuovo engine, come se l'app venisse riavviata. */
export function createMemoryStore(): LocalStore {
  let device: DeviceRecord | undefined;
  const events = new Map<string, StoredEvent>();
  return {
    loadDevice: () => Promise.resolve(device),
    loadEvents: () => Promise.resolve([...events.values()]),
    save(newEvents, newDevice) {
      for (const event of newEvents) if (!events.has(event.id)) events.set(event.id, event);
      device = newDevice;
      return Promise.resolve();
    },
  };
}

/** Orologio manuale per i test: parte da `start` e avanza solo quando lo si chiede. */
export function createManualClock(
  start = 1_760_000_000_000,
): Clock & { advance(ms: number): void } {
  let now = start;
  return {
    now: () => now,
    advance(ms) {
      now += ms;
    },
  };
}

/** Id prevedibili per i test: "id_00001", "id_00002", … (con il prefisso indicato). */
export function createSequentialIds(prefix = 'id'): IdGenerator {
  let next = 0;
  return {
    newId() {
      next += 1;
      return `${prefix}_${String(next).padStart(5, '0')}`;
    },
  };
}

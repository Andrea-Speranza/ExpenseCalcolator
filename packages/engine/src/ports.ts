import type { DeviceId, ProfileId, StoredEvent } from '@expense/schema';
import type { HlcClock } from '@expense/sync';

// Porte: ciò che l'engine chiede alla piattaforma (PLANNING §5.4). Le implementazioni stanno negli adapter
// (es. IndexedDB) o, per i test, in memoria (memory.ts).

/** Ora corrente in millisecondi. */
export interface Clock {
  now(): number;
}

/** Identificativi univoci (ULID o simili): per eventi, gruppi, membri, spese e rimborsi. */
export interface IdGenerator {
  newId(): string;
}

/** Identità di questa installazione, creata alla prima apertura, con lo stato del suo orologio. */
export interface DeviceRecord {
  readonly deviceId: DeviceId;
  readonly profileId: ProfileId;
  readonly clock: HlcClock;
}

/** Salvataggio locale di eventi e identità del dispositivo (ADR 0007, punto 9). */
export interface LocalStore {
  loadDevice(): Promise<DeviceRecord | undefined>;
  /** Tutti gli eventi salvati, di tutti i log, così come sono stati scritti: l'engine li valida. */
  loadEvents(): Promise<readonly unknown[]>;
  /**
   * Salva nuovi eventi e il nuovo stato del dispositivo nella stessa transazione: o tutto o niente.
   * Un evento con un id già salvato si ignora.
   */
  save(events: readonly StoredEvent[], device: DeviceRecord): Promise<void>;
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DeviceRecord, HlcClock, LocalStore } from '@expense/engine';

// Salvataggio locale su file, per Node (es. la CLI). Eventi e identità del dispositivo stanno in un unico file
// JSON, scritto in modo atomico: prima su un file temporaneo, poi rinominato al posto del precedente. Così
// non si ritrova mai un file scritto a metà (ADR 0007, punto 9).

export interface FileStoreOptions {
  /** Cartella dei dati: viene creata se non esiste. */
  readonly directory: string;
}

export const DATA_FILE = 'dati.json';

interface FileContent {
  readonly format: 1;
  readonly device: DeviceRecord | null;
  readonly events: readonly unknown[];
}

const EMPTY: FileContent = { format: 1, device: null, events: [] };

export async function openFileStore({ directory }: FileStoreOptions): Promise<LocalStore> {
  await mkdir(directory, { recursive: true });
  const path = join(directory, DATA_FILE);
  return {
    async loadDevice() {
      return (await readContent(path)).device ?? undefined;
    },
    async loadEvents() {
      return (await readContent(path)).events;
    },
    async save(events, device) {
      // Si rilegge il file subito prima di scrivere: se un'altra finestra aperta sugli stessi dati ha aggiunto
      // eventi nel frattempo, si tengono anche quelli. Gli eventi sono immutabili, quindi unirli è sicuro.
      const current = await readContent(path);
      const byId = new Map<string, unknown>();
      for (const event of [...current.events, ...events]) {
        const id = idOf(event);
        if (id !== undefined && !byId.has(id)) byId.set(id, event);
      }
      const content: FileContent = {
        format: 1,
        device: { ...device, clock: laterClock(current.device?.clock, device.clock) },
        events: [...byId.values()],
      };
      const temporary = `${path}.${String(process.pid)}.${String(Date.now())}.tmp`;
      await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
      await rename(temporary, path);
    },
  };
}

async function readContent(path: string): Promise<FileContent> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return EMPTY;
    throw error;
  }
  const data: unknown = JSON.parse(text);
  if (!isFileContent(data))
    throw new Error(`Il file dei dati "${path}" non ha il formato previsto.`);
  return data;
}

function laterClock(a: HlcClock | undefined, b: HlcClock): HlcClock {
  if (a === undefined) return b;
  return a.wallTime > b.wallTime || (a.wallTime === b.wallTime && a.counter > b.counter) ? a : b;
}

function idOf(event: unknown): string | undefined {
  if (typeof event !== 'object' || event === null || !('id' in event)) return undefined;
  return typeof event.id === 'string' ? event.id : undefined;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isFileContent(value: unknown): value is FileContent {
  if (typeof value !== 'object' || value === null) return false;
  const { format, device, events } = value as Partial<Record<keyof FileContent, unknown>>;
  return format === 1 && Array.isArray(events) && (device === null || isDeviceRecord(device));
}

function isDeviceRecord(value: unknown): value is DeviceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const { deviceId, profileId, clock } = value as Partial<Record<keyof DeviceRecord, unknown>>;
  if (typeof deviceId !== 'string' || typeof profileId !== 'string') return false;
  if (typeof clock !== 'object' || clock === null) return false;
  const { wallTime, counter } = clock as Partial<Record<keyof HlcClock, unknown>>;
  return typeof wallTime === 'number' && typeof counter === 'number';
}

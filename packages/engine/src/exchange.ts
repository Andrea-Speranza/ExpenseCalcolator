import { err, ok, type Result } from '@expense/core';
import {
  EXCHANGE_FILE_FORMAT,
  type ExchangeFile,
  ExchangeFileSchema,
  type GroupId,
} from '@expense/schema';
import type { Engine, ReceiveSummary } from './engine';
import type { InvalidExchangeFile, NotFound, StorageFailed } from './errors';
import type { GroupSummary } from './views';

// Esportazione e importazione di un gruppo con un file di scambio (canale "file", ADR 0006). È il modo
// manuale di passare un gruppo a un altro dispositivo o a un'altra persona, e una copia di sicurezza.
// Le stesse funzioni servono a CLI, web app e app native: il formato è uno solo.

/** Versione del formato del file che questa app scrive e sa leggere. */
const EXCHANGE_FILE_VERSION = 1;

/** Tutti gli eventi del gruppo, nel formato del file di scambio. */
export function exportGroupFile(engine: Engine, groupId: GroupId): Result<ExchangeFile, NotFound> {
  const group = engine.query({ type: 'GetGroup', groupId });
  if (!group.ok) return err({ code: 'NotFound', entity: 'group', id: groupId });
  return ok({
    format: EXCHANGE_FILE_FORMAT,
    version: EXCHANGE_FILE_VERSION,
    group: group.value.name,
    events: engine.exportEvents(groupId),
  });
}

/** Il contenuto da salvare su disco: JSON leggibile, con l'a capo finale. */
export function serializeExchangeFile(file: ExchangeFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Legge un file di scambio. Accetta anche il BOM che alcuni editor di Windows aggiungono all'inizio. */
export function parseExchangeFile(text: string): Result<ExchangeFile, InvalidExchangeFile> {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return err({ code: 'InvalidExchangeFile', reason: 'notJson' });
  }
  const parsed = ExchangeFileSchema.safeParse(data);
  if (!parsed.success) return err({ code: 'InvalidExchangeFile', reason: 'notExchangeFile' });
  if (parsed.data.version > EXCHANGE_FILE_VERSION) {
    return err({ code: 'InvalidExchangeFile', reason: 'newerVersion' });
  }
  return ok(parsed.data);
}

export interface ImportSummary extends ReceiveSummary {
  /** I gruppi contenuti nel file, come risultano dopo l'importazione. */
  readonly groups: readonly GroupSummary[];
}

/** Importa gli eventi del file: solo quelli nuovi e validi; gli altri si contano e si scartano. */
export async function importExchangeFile(
  engine: Engine,
  file: ExchangeFile,
): Promise<Result<ImportSummary, StorageFailed>> {
  const received = await engine.receiveEvents(file.events);
  if (!received.ok) return received;
  const streams = new Set(file.events.flatMap((event) => (hasStream(event) ? [event.stream] : [])));
  const groups = engine.query({ type: 'ListGroups' });
  return ok({
    ...received.value,
    groups: groups.ok ? groups.value.filter(({ groupId }) => streams.has(groupId)) : [],
  });
}

function hasStream(event: unknown): event is { readonly stream: string } {
  return (
    typeof event === 'object' &&
    event !== null &&
    'stream' in event &&
    typeof event.stream === 'string'
  );
}

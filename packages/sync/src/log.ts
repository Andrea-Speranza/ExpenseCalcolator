import { compareText } from './text';

interface Ordered {
  readonly id: string;
  readonly hlc: string;
}

/**
 * Eventi senza doppioni e nell'ordine canonico: per HLC e, a parità, per id (PLANNING §8.3).
 * Il risultato non dipende dall'ordine né dal numero di volte in cui gli eventi sono arrivati.
 * Se due eventi diversi avessero lo stesso id (dati corrotti o manomessi), si tiene sempre lo stesso,
 * scelto in modo deterministico, su ogni dispositivo.
 */
export function orderEvents<E extends Ordered>(events: Iterable<E>): E[] {
  const unique = new Map<string, E>();
  for (const event of events) {
    const current = unique.get(event.id);
    if (current === undefined || precedes(event, current)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((a, b) => compareText(a.hlc, b.hlc) || compareText(a.id, b.id));
}

function precedes(a: Ordered, b: Ordered): boolean {
  return (compareText(a.hlc, b.hlc) || compareText(JSON.stringify(a), JSON.stringify(b))) < 0;
}

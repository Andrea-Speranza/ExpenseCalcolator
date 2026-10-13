import type { Hlc } from '@expense/schema';
import { parseHlc } from '@expense/sync';

/**
 * Quando è stata scritta una modifica: i millisecondi dal 1970 contenuti nel suo HLC, presi dall'orologio del
 * dispositivo che l'ha scritta (ADR 0007). Serve a mostrarlo all'utente (es. "inserita alle 16:42"); per
 * ordinare le modifiche conta l'HLC intero. Null se l'etichetta non è valida.
 */
export function timeOfHlc(hlc: Hlc): number | null {
  return parseHlc(hlc)?.wallTime ?? null;
}

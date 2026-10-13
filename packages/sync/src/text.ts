/**
 * Ordina due stringhe per code unit. A differenza di `localeCompare` non dipende dalla lingua del
 * dispositivo: è il confronto che rende gli HLC ordinabili come testo.
 */
export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

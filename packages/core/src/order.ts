/**
 * Ordina due stringhe per code unit. A differenza di `localeCompare` non dipende dalla lingua del
 * dispositivo, quindi l'ordine dei risultati è lo stesso ovunque.
 */
export function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

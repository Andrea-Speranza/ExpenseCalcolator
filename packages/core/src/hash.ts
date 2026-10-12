/**
 * Hash FNV-1a a 32 bit dei code unit UTF-16 del testo. Serve solo per scelte deterministiche, come la
 * rotazione dello spareggio nelle ripartizioni (PLANNING §9.3): non è un hash crittografico.
 * Gli id sono ASCII, quindi il risultato coincide con l'FNV-1a dei byte UTF-8 in qualsiasi linguaggio.
 */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

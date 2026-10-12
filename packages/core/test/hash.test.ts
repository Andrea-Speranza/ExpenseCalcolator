import { describe, expect, it } from 'vitest';
import { stableHash } from '../src/hash';

describe('stableHash (FNV-1a a 32 bit)', () => {
  // Valori di riferimento pubblicati per FNV-1a: garantiscono che altre implementazioni del core,
  // in qualsiasi linguaggio, scelgano la stessa rotazione.
  it.each([
    ['', 0x811c9dc5],
    ['a', 0xe40c292c],
    ['foobar', 0xbf9cf968],
    ['e_1', 0x3c072b94],
  ])('%j → %i', (text, expected) => {
    expect(stableHash(text)).toBe(expected);
  });

  it('restituisce sempre un intero senza segno a 32 bit', () => {
    const hash = stableHash('01J9Z5XK3M7Q8R2T4V6W8Y0A1B');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});

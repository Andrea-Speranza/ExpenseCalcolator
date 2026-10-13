import { describe, expect, it } from 'vitest';
import { timeOfHlc } from '../src/index';

describe('timeOfHlc', () => {
  it('restituisce i millisecondi dell’orologio contenuti nell’etichetta', () => {
    expect(timeOfHlc('1760000000000:00003:dev_1')).toBe(1_760_000_000_000);
  });

  it('restituisce null per un’etichetta non valida', () => {
    expect(timeOfHlc('ieri')).toBeNull();
  });
});

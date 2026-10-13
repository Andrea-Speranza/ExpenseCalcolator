import { MemberIdSchema } from '@expense/schema';
import { describe, expect, it } from 'vitest';
import { createSystemClock, createUlidGenerator, encodeUlid } from '../src/index';

describe('createSystemClock', () => {
  it('restituisce l’ora di sistema in millisecondi', () => {
    const before = Date.now();
    const now = createSystemClock().now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(Number.isSafeInteger(now)).toBe(true);
  });
});

describe('ULID', () => {
  it('codifica ora e casualità in 26 caratteri Crockford', () => {
    expect(encodeUlid(0, new Uint8Array(16))).toBe('00000000000000000000000000');
    // Valore atteso calcolato a parte: (1760000000000n).toString(32), rimappato sull'alfabeto Crockford.
    expect(encodeUlid(1_760_000_000_000, new Uint8Array(16).fill(31))).toBe(
      '01K742SG00ZZZZZZZZZZZZZZZZ',
    );
  });

  it('id ordinati per tempo di creazione, validi come identificativi dei dati', () => {
    let now = 1_760_000_000_000;
    const ids = createUlidGenerator({ now: () => now++ });
    const generated = Array.from({ length: 50 }, () => ids.newId());
    expect([...generated].sort()).toEqual(generated);
    for (const id of generated) {
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(MemberIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it('nello stesso millisecondo gli id restano diversi, grazie alla casualità', () => {
    const ids = createUlidGenerator({ now: () => 1_760_000_000_000 });
    const generated = new Set(Array.from({ length: 1000 }, () => ids.newId()));
    expect(generated.size).toBe(1000);
  });
});

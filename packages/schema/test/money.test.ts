import { describe, expect, it } from 'vitest';
import { CurrencyCodeSchema, MoneySchema } from '../src/index';

describe('CurrencyCodeSchema', () => {
  it('accetta tre lettere maiuscole', () => {
    expect(CurrencyCodeSchema.safeParse('EUR').success).toBe(true);
  });

  it.each(['eur', 'EU', 'EURO', 'E1R', ''])('rifiuta %j', (code) => {
    expect(CurrencyCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe('MoneySchema', () => {
  it('accetta un importo intero con la sua valuta', () => {
    expect(MoneySchema.parse({ minor: 1234, currency: 'EUR' })).toEqual({
      minor: 1234,
      currency: 'EUR',
    });
  });

  it('accetta importi negativi (es. saldi)', () => {
    expect(MoneySchema.safeParse({ minor: -500, currency: 'EUR' }).success).toBe(true);
  });

  it.each([
    ['decimali', { minor: 12.34, currency: 'EUR' }],
    ['oltre gli interi sicuri', { minor: Number.MAX_SAFE_INTEGER + 1, currency: 'EUR' }],
    ['senza valuta', { minor: 100 }],
    ['valuta non valida', { minor: 100, currency: 'euro' }],
  ])('rifiuta un importo %s', (_case, value) => {
    expect(MoneySchema.safeParse(value).success).toBe(false);
  });
});

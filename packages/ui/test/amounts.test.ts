import { describe, expect, it } from 'vitest';
import { parseAmount, parsePercentage, parseWeight } from '../src/amounts';
import {
  amountInputValue,
  currencyLabel,
  formatDate,
  formatMoney,
  formatPercentage,
  today,
} from '../src/format';

/** Gli spazi non separabili che Intl mette negli importi diventano spazi normali. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

describe('parseAmount', () => {
  it('accetta la virgola e il punto come separatore decimale', () => {
    expect(parseAmount('12,50', 'EUR')).toEqual({
      ok: true,
      value: { minor: 1250, currency: 'EUR' },
    });
    expect(parseAmount(' 12.5 ', 'EUR')).toEqual({
      ok: true,
      value: { minor: 1250, currency: 'EUR' },
    });
  });

  it('spiega gli errori', () => {
    expect(parseAmount('', 'EUR')).toEqual({ ok: false, error: 'Indica un importo.' });
    expect(parseAmount('dieci', 'EUR')).toMatchObject({ ok: false });
    expect(parseAmount('1,234', 'EUR')).toEqual({
      ok: false,
      error: 'In EUR si usano al massimo 2 decimali.',
    });
    expect(parseAmount('1,5', 'JPY')).toEqual({
      ok: false,
      error: 'In JPY non si usano decimali.',
    });
  });
});

describe('parsePercentage e parseWeight', () => {
  it('convertono in punti base e quote intere', () => {
    expect(parsePercentage('33,33')).toEqual({ ok: true, value: 3333 });
    expect(parsePercentage('50')).toEqual({ ok: true, value: 5000 });
    expect(parsePercentage('100,5')).toMatchObject({ ok: false });
    expect(parsePercentage('1,234')).toMatchObject({ ok: false });
    expect(parseWeight('2')).toEqual({ ok: true, value: 2 });
    expect(parseWeight('1,5')).toMatchObject({ ok: false });
  });
});

describe('formattazione', () => {
  it('mostra gli importi in italiano, senza perdere precisione', () => {
    expect(plain(formatMoney({ minor: 123_450, currency: 'EUR' }))).toBe('1234,50 €');
    expect(plain(formatMoney({ minor: 1_234_567, currency: 'EUR' }))).toBe('12.345,67 €');
    expect(plain(formatMoney({ minor: 9_007_199_254_740_991, currency: 'EUR' }))).toBe(
      '90.071.992.547.409,91 €',
    );
    expect(plain(formatMoney({ minor: -500, currency: 'EUR' }, true))).toBe('-5,00 €');
    expect(plain(formatMoney({ minor: 500, currency: 'JPY' }, true))).toBe('+500 JPY');
  });

  it('prepara i valori per i campi dei form', () => {
    expect(amountInputValue({ minor: 1250, currency: 'EUR' })).toBe('12,50');
    expect(formatPercentage(3333)).toBe('33,33%');
  });

  it('mostra le date in italiano, senza effetti del fuso orario', () => {
    expect(formatDate('2026-10-13')).toBe('13 ott 2026');
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('dà il nome delle valute', () => {
    expect(currencyLabel('EUR')).toBe('EUR · euro');
  });
});

import { describe, expect, it } from 'vitest';
import { decimalsOf, isKnownCurrency, knownCurrencies } from '../src/index';
import { unwrap, unwrapError } from './helpers';

describe('decimalsOf', () => {
  it.each([
    ['EUR', 2],
    ['USD', 2],
    ['JPY', 0],
    ['KRW', 0],
    ['KWD', 3],
    ['TND', 3],
  ])('%s ha %i decimali', (currency, decimals) => {
    expect(unwrap(decimalsOf(currency))).toBe(decimals);
  });

  it('segnala una valuta sconosciuta', () => {
    expect(unwrapError(decimalsOf('XYZ'))).toEqual({ code: 'UnknownCurrency', currency: 'XYZ' });
  });
});

describe('knownCurrencies', () => {
  const currencies = knownCurrencies();

  it('elenca codici ISO 4217 unici in ordine alfabetico', () => {
    expect(new Set(currencies).size).toBe(currencies.length);
    expect([...currencies].sort()).toEqual(currencies);
    for (const code of currencies) expect(code).toMatch(/^[A-Z]{3}$/);
  });

  it('assegna a ogni valuta 0, 2 o 3 decimali', () => {
    for (const code of currencies) expect([0, 2, 3]).toContain(unwrap(decimalsOf(code)));
  });

  it('riconosce solo le valute in tabella', () => {
    expect(isKnownCurrency('EUR')).toBe(true);
    expect(isKnownCurrency('XYZ')).toBe(false);
    expect(isKnownCurrency('eur')).toBe(false);
  });
});
